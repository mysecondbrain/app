#!/usr/bin/env python3
"""
Backend API Testing Script
Tests FastAPI endpoints for the offline notes application
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, List

# Get base URL from frontend environment
import os
from pathlib import Path

def get_backend_url():
    """Get backend URL from frontend .env file"""
    frontend_env_path = Path("/app/frontend/.env")
    if frontend_env_path.exists():
        with open(frontend_env_path, 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    base_url = line.split('=', 1)[1].strip().strip('"')
                    return f"{base_url}/api"
    
    # Fallback to localhost if env not found
    return "http://localhost:8001/api"

BASE_URL = get_backend_url()
print(f"Testing backend at: {BASE_URL}")

class BackendTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def test_status_post(self) -> Dict[str, Any]:
        """Test POST /api/status endpoint"""
        print("\n=== Testing POST /api/status ===")
        
        try:
            payload = {"client_name": "tester"}
            response = self.session.post(f"{self.base_url}/status", json=payload)
            
            if response.status_code != 200:
                self.log_test("POST /api/status - Status Code", False, f"Expected 200, got {response.status_code}")
                return None
            
            self.log_test("POST /api/status - Status Code", True, "200 OK")
            
            # Check response structure
            try:
                data = response.json()
                required_fields = ["id", "client_name", "timestamp"]
                
                for field in required_fields:
                    if field not in data:
                        self.log_test(f"POST /api/status - Field '{field}'", False, f"Missing field: {field}")
                        return None
                
                # Validate field values
                if data["client_name"] != "tester":
                    self.log_test("POST /api/status - client_name value", False, f"Expected 'tester', got '{data['client_name']}'")
                    return None
                
                if not data["id"]:
                    self.log_test("POST /api/status - id value", False, "ID field is empty")
                    return None
                
                # Validate timestamp format
                try:
                    datetime.fromisoformat(data["timestamp"].replace('Z', '+00:00'))
                    self.log_test("POST /api/status - timestamp format", True, "Valid ISO format")
                except:
                    self.log_test("POST /api/status - timestamp format", False, f"Invalid timestamp: {data['timestamp']}")
                
                self.log_test("POST /api/status - Response Structure", True, "All required fields present")
                return data
                
            except json.JSONDecodeError:
                self.log_test("POST /api/status - JSON Response", False, "Invalid JSON response")
                return None
                
        except requests.exceptions.RequestException as e:
            self.log_test("POST /api/status - Connection", False, f"Request failed: {str(e)}")
            return None
    
    def test_status_get(self, expected_status: Dict[str, Any] = None):
        """Test GET /api/status endpoint"""
        print("\n=== Testing GET /api/status ===")
        
        try:
            response = self.session.get(f"{self.base_url}/status")
            
            if response.status_code != 200:
                self.log_test("GET /api/status - Status Code", False, f"Expected 200, got {response.status_code}")
                return
            
            self.log_test("GET /api/status - Status Code", True, "200 OK")
            
            try:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_test("GET /api/status - Response Type", False, f"Expected array, got {type(data)}")
                    return
                
                self.log_test("GET /api/status - Response Type", True, "Array response")
                
                # If we have an expected status from POST, check if it's in the array
                if expected_status:
                    found = False
                    for item in data:
                        if (item.get("id") == expected_status.get("id") and 
                            item.get("client_name") == expected_status.get("client_name")):
                            found = True
                            break
                    
                    if found:
                        self.log_test("GET /api/status - Contains Posted Status", True, "Posted status found in array")
                    else:
                        self.log_test("GET /api/status - Contains Posted Status", False, "Posted status not found in array")
                
                self.log_test("GET /api/status - Overall", True, f"Retrieved {len(data)} status entries")
                
            except json.JSONDecodeError:
                self.log_test("GET /api/status - JSON Response", False, "Invalid JSON response")
                
        except requests.exceptions.RequestException as e:
            self.log_test("GET /api/status - Connection", False, f"Request failed: {str(e)}")
    
    def test_ai_annotate_basic(self):
        """Test POST /api/ai/annotate with basic payload"""
        print("\n=== Testing POST /api/ai/annotate (Basic) ===")
        
        try:
            payload = {"text": "This is a short business meeting note about sales and marketing."}
            response = self.session.post(f"{self.base_url}/ai/annotate", json=payload)
            
            if response.status_code != 200:
                self.log_test("POST /api/ai/annotate - Status Code", False, f"Expected 200, got {response.status_code}")
                if response.status_code == 503:
                    self.log_test("POST /api/ai/annotate - Service Availability", False, "AI service not configured (EMERGENT_LLM_KEY missing)")
                return
            
            self.log_test("POST /api/ai/annotate - Status Code", True, "200 OK")
            
            try:
                data = response.json()
                required_fields = ["categories", "tags", "summary", "processing_time", "metadata"]
                
                for field in required_fields:
                    if field not in data:
                        self.log_test(f"POST /api/ai/annotate - Field '{field}'", False, f"Missing field: {field}")
                        return
                
                # Validate field types
                if not isinstance(data["categories"], list):
                    self.log_test("POST /api/ai/annotate - categories type", False, f"Expected array, got {type(data['categories'])}")
                    return
                
                if not isinstance(data["tags"], list):
                    self.log_test("POST /api/ai/annotate - tags type", False, f"Expected array, got {type(data['tags'])}")
                    return
                
                if not isinstance(data["summary"], str):
                    self.log_test("POST /api/ai/annotate - summary type", False, f"Expected string, got {type(data['summary'])}")
                    return
                
                # Check metadata note
                if data.get("metadata", {}).get("note") != "placeholder-no-ai":
                    self.log_test("POST /api/ai/annotate - metadata.note", False, f"Expected 'placeholder-no-ai', got '{data.get('metadata', {}).get('note')}'")
                    return
                
                self.log_test("POST /api/ai/annotate - Response Structure", True, "All required fields present with correct types")
                self.log_test("POST /api/ai/annotate - Placeholder Implementation", True, "Metadata indicates placeholder implementation")
                
            except json.JSONDecodeError:
                self.log_test("POST /api/ai/annotate - JSON Response", False, "Invalid JSON response")
                
        except requests.exceptions.RequestException as e:
            self.log_test("POST /api/ai/annotate - Connection", False, f"Request failed: {str(e)}")
    
    def test_ai_annotate_custom_categories(self):
        """Test POST /api/ai/annotate with custom categories and include_confidence=false"""
        print("\n=== Testing POST /api/ai/annotate (Custom Categories) ===")
        
        try:
            payload = {
                "text": "This is a business meeting note about sales and marketing strategies.",
                "custom_categories": ["Business", "Private"],
                "include_confidence": False
            }
            response = self.session.post(f"{self.base_url}/ai/annotate", json=payload)
            
            if response.status_code != 200:
                self.log_test("POST /api/ai/annotate (Custom) - Status Code", False, f"Expected 200, got {response.status_code}")
                return
            
            self.log_test("POST /api/ai/annotate (Custom) - Status Code", True, "200 OK")
            
            try:
                data = response.json()
                
                # Check that categories are subset of provided custom_categories
                provided_categories = set(["Business", "Private"])
                returned_categories = set(data.get("categories", []))
                
                if not returned_categories.issubset(provided_categories):
                    self.log_test("POST /api/ai/annotate (Custom) - Categories Subset", False, f"Categories {returned_categories} not subset of {provided_categories}")
                    return
                
                self.log_test("POST /api/ai/annotate (Custom) - Categories Subset", True, "Categories are subset of provided custom_categories")
                
                # Check that confidence is null when include_confidence=false
                if data.get("confidence") is not None:
                    self.log_test("POST /api/ai/annotate (Custom) - Confidence Null", False, f"Expected null confidence, got {data.get('confidence')}")
                    return
                
                self.log_test("POST /api/ai/annotate (Custom) - Confidence Null", True, "Confidence is null as expected")
                
            except json.JSONDecodeError:
                self.log_test("POST /api/ai/annotate (Custom) - JSON Response", False, "Invalid JSON response")
                
        except requests.exceptions.RequestException as e:
            self.log_test("POST /api/ai/annotate (Custom) - Connection", False, f"Request failed: {str(e)}")
    
    def test_ai_annotate_empty_text(self):
        """Test POST /api/ai/annotate with empty text (should return 422)"""
        print("\n=== Testing POST /api/ai/annotate (Empty Text) ===")
        
        try:
            payload = {"text": ""}
            response = self.session.post(f"{self.base_url}/ai/annotate", json=payload)
            
            if response.status_code != 422:
                self.log_test("POST /api/ai/annotate (Empty) - Status Code", False, f"Expected 422, got {response.status_code}")
                return
            
            self.log_test("POST /api/ai/annotate (Empty) - Status Code", True, "422 Validation Error")
            self.log_test("POST /api/ai/annotate (Empty) - Validation", True, "Empty text properly rejected")
            
        except requests.exceptions.RequestException as e:
            self.log_test("POST /api/ai/annotate (Empty) - Connection", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting Backend API Tests")
        print(f"Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test status endpoints
        posted_status = self.test_status_post()
        self.test_status_get(posted_status)
        
        # Test AI annotate endpoints
        self.test_ai_annotate_basic()
        self.test_ai_annotate_custom_categories()
        self.test_ai_annotate_empty_text()
        
        # Summary
        print("\n" + "=" * 60)
        print("🏁 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        exit(0)
    else:
        print("\n💥 Some tests failed!")
        exit(1)