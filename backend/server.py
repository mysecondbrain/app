from fastapi import FastAPI, APIRouter, HTTPException, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Read AI key (do not require at startup; endpoint will validate)
EMERGENT_LLM_KEY = os.getenv('EMERGENT_LLM_KEY')

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


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

# Add your routes to the router instead of directly to app
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
async def annotate_text(input: AnnotationRequest):
    # Security: ensure key configured
    if not EMERGENT_LLM_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service not configured. Please set EMERGENT_LLM_KEY in backend environment."
        )

    import time, json, os
    import requests

    start = time.time()

    # Build a strict JSON-instruction prompt
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
- 3-8 tags, lowercase, hyphenated if multi-word
- 1-2 sentence summary
- confidence in [0.0, 1.0]
Text:\n{input.text}
"""

    # Attempt a universal LLM call (OpenAI-compatible schema) via Emergent gateway if configured
    base_url = os.getenv("EMERGENT_LLM_BASE_URL", "https://api.emergent-llm.gateway/v1")
    endpoint = f"{base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {EMERGENT_LLM_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "offline-notes/ai-annotate"
    }
    payload = {
        "model": input.model or os.getenv("EMERGENT_DEFAULT_MODEL", "gpt-4o-mini"),
        "messages": [
            {"role": "system", "content": "Return structured JSON as requested."},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "max_tokens": 400
    }

    try:
        resp = requests.post(endpoint, headers=headers, json=payload, timeout=25)
        if resp.status_code == 401:
            # Auth issue – fall back
            raise RuntimeError("Unauthorized from LLM gateway")
        resp.raise_for_status()
        data = resp.json()
        content = None
        if isinstance(data, dict) and "choices" in data and data["choices"]:
            content = data["choices"][0]["message"]["content"]
        elif isinstance(data, dict) and "output" in data:
            content = data["output"]

        if not content:
            raise RuntimeError("No content returned from LLM service")

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            # Try to strip code fences
            text = content.strip()
            if text.startswith("```") and text.endswith("```"):
                text = "\n".join(text.splitlines()[1:-1]).strip()
            parsed = json.loads(text)

        processing_time = round(time.time() - start, 3)
        return AnnotationResponse(
            categories=list(parsed.get("categories", []))[:3],
            tags=list(parsed.get("tags", []))[:8],
            summary=str(parsed.get("summary", ""))[:1000],
            confidence=None if not input.include_confidence else float(parsed.get("confidence", 0.0)),
            processing_time=processing_time,
            metadata={
                "source": "emergent-llm",
                "model": payload["model"],
                "gateway": base_url
            }
        )
    except Exception:
        # Graceful fallback: deterministic placeholder
        text = input.text.strip()
        words = [w.lower() for w in ''.join([c if c.isalnum() or c.isspace() else ' ' for c in text]).split()]
        uniq = []
        for w in words:
            if len(w) > 3 and w not in uniq:
                uniq.append(w)
        tags = uniq[:5]
        categories = input.custom_categories[:2] if input.custom_categories else []
        summary = (text[:180] + '...') if len(text) > 200 else text
        processing_time = round(time.time() - start, 3)
        return AnnotationResponse(
            categories=categories,
            tags=tags,
            summary=summary,
            confidence=None if not input.include_confidence else 0.0,
            processing_time=processing_time,
            metadata={"note": "fallback-no-external-llm"}
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
