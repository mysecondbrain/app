from fastapi import FastAPI, APIRouter, HTTPException, status, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import asyncio
import json
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.getenv('EMERGENT_LLM_KEY')
EMERGENT_LLM_BASE_URL = os.getenv('EMERGENT_LLM_BASE_URL', 'https://api.emergent-llm.gateway/v1')
EMERGENT_DEFAULT_MODEL = os.getenv('EMERGENT_DEFAULT_MODEL', 'gpt-4o-mini')
AI_TIMEOUT_SECONDS = int(os.getenv('AI_TIMEOUT_SECONDS', '25'))
AI_MAX_RETRIES = int(os.getenv('AI_MAX_RETRIES', '2'))
RATE_LIMIT_PER_MIN = int(os.getenv('AI_RATE_LIMIT_PER_MIN', '30'))

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# simple in-memory rate limiter per client IP
_rate: Dict[str, List[datetime]] = {}

def rate_guard(ip: str):
  now = datetime.utcnow()
  window = now - timedelta(minutes=1)
  lst = _rate.get(ip, [])
  lst = [t for t in lst if t > window]
  if len(lst) >= RATE_LIMIT_PER_MIN:
    _rate[ip] = lst
    raise HTTPException(status_code=429, detail="AI rate limit exceeded")
  lst.append(now)
  _rate[ip] = lst

# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class AnnotationRequest(BaseModel):
    text: str = Field(min_length=1, max_length=50000)
    model: Optional[str] = None
    custom_categories: Optional[List[str]] = None
    include_confidence: bool = True

class AnnotationResponse(BaseModel):
    categories: List[str]
    tags: List[str]
    summary: str
    confidence: Optional[float] = None
    processing_time: Optional[float] = None
    metadata: Optional[dict] = None

@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

@api_router.post("/ai/annotate", response_model=AnnotationResponse)
async def annotate_text(req: Request, input: AnnotationRequest):
    # rate guard
    rate_guard(req.client.host if req.client else 'unknown')

    if not EMERGENT_LLM_KEY:
        # Privacy-first: no online call, return deterministic fallback below
        EMERGENT_MISSING = True
    else:
        EMERGENT_MISSING = False

    async def call_llm() -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {EMERGENT_LLM_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "offline-notes/ai-annotate"
        }
        categories_instruction = (
            f"Use these categories strictly: {', '.join(input.custom_categories)}"
            if input.custom_categories else
            "Choose 1-3 suitable categories (e.g., Business, Private, Health, Travel, Finance)"
        )
        user_prompt = f"""
You are an expert annotation service. Analyze the text and return ONLY valid JSON with:
{{
  "categories": [".."],
  "tags": [".."],
  "summary": "..",
  "confidence": 0.0
}}
Rules:
- {categories_instruction}
- 3-8 tags, lowercase
- 1-2 sentence summary
- confidence in [0.0, 1.0]
Text:\n{input.text}
"""
        payload = {
            "model": input.model or EMERGENT_DEFAULT_MODEL,
            "messages": [
                {"role": "system", "content": "Return structured JSON as requested."},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "max_tokens": 400
        }
        url = f"{EMERGENT_LLM_BASE_URL}/chat/completions"
        r = requests.post(url, headers=headers, json=payload, timeout=AI_TIMEOUT_SECONDS)
        if r.status_code == 429:
            raise HTTPException(status_code=429, detail="AI rate limit upstream")
        r.raise_for_status()
        return r.json()

    start = datetime.utcnow()
    # retry with backoff
    last_exc: Optional[Exception] = None
    for attempt in range(AI_MAX_RETRIES + 1):
        try:
            data = await asyncio.wait_for(call_llm(), timeout=AI_TIMEOUT_SECONDS)
            content: Optional[str] = None
            if isinstance(data, dict) and data.get("choices"):
                content = data["choices"][0]["message"]["content"]
            elif isinstance(data, dict) and data.get("output"):
                content = data["output"]
            if not content:
                raise ValueError("No content from LLM")
            try:
                parsed = json.loads(content)
            except json.JSONDecodeError:
                txt = content.strip()
                if txt.startswith("```") and txt.endswith("```"):
                    txt = "\n".join(txt.splitlines()[1:-1]).strip()
                parsed = json.loads(txt)
            dt = (datetime.utcnow() - start).total_seconds()
            return AnnotationResponse(
                categories=[str(x) for x in (parsed.get("categories") or [])][:3],
                tags=[str(x).lower() for x in (parsed.get("tags") or [])][:8],
                summary=str(parsed.get("summary") or "")[:2000],
                confidence=(None if not input.include_confidence else float(parsed.get("confidence") or 0.0)),
                processing_time=dt,
                metadata={"model": input.model or EMERGENT_DEFAULT_MODEL}
            )
        except Exception as e:
            last_exc = e
            if attempt < AI_MAX_RETRIES:
                await asyncio.sleep(1.5 * (attempt + 1))
            else:
                break

    # deterministic fallback
    text = input.text.strip()
    words = [w.lower() for w in ''.join([c if c.isalnum() or c.isspace() else ' ' for c in text]).split()]
    uniq: List[str] = []
    for w in words:
        if len(w) > 3 and w not in uniq:
            uniq.append(w)
    tags = uniq[:5]
    categories = input.custom_categories[:2] if input.custom_categories else []
    summary = (text[:180] + '...') if len(text) > 200 else text
    dt = (datetime.utcnow() - start).total_seconds()
    return AnnotationResponse(
        categories=categories,
        tags=tags,
        summary=summary,
        confidence=(None if not input.include_confidence else 0.0),
        processing_time=dt,
        metadata={"note": "fallback-no-external-llm", "error": str(last_exc)[:200] if last_exc else None}
    )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()