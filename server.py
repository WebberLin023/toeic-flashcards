import os
import json
import re
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
from youtube_transcript_api import YouTubeTranscriptApi
from google import genai
from google.genai import types

app = FastAPI()

class GenerateRequest(BaseModel):
    url: str
    api_key: str
    scenario: str = "TOEIC" # TOEIC, GEPT, Daily

class ManualGenerateRequest(BaseModel):
    words: str
    api_key: str
    scenario: str = "TOEIC"

class UpdateStatusRequest(BaseModel):
    word: str
    status: int
    scenario: str = "TOEIC"

class ClearDataRequest(BaseModel):
    scenario: str = "TOEIC"

DATA_FILE = "data.json"

def get_video_id(url):
    regex = r"(?:v=|\/)([0-9A-Za-z_-]{11}).*"
    match = re.search(regex, url)
    if match:
        return match.group(1)
    return None

def get_empty_data():
    return {
        "TOEIC": {"words": [], "historyUrls": []},
        "GEPT": {"words": [], "historyUrls": []},
        "Daily": {"words": [], "historyUrls": []}
    }

def migrate_data(data):
    """Migrate old data format to new format"""
    needs_save = False
    
    # Check if this is the old flat format
    if "words" in data or "mainWords" in data or "derivativeWords" in data or "historyUrls" in data:
        # Determine if it's purely old format by checking for TOEIC
        if "TOEIC" not in data:
            old_words = data.get("words", [])
            if "mainWords" in data:
                old_words.extend(data.get("mainWords", []))
            if "derivativeWords" in data:
                old_words.extend(data.get("derivativeWords", []))
                
            old_history = data.get("historyUrls", [])
            
            # Deduplicate and fix status
            unique_words = {}
            for item in old_words:
                if "status" not in item:
                    item["status"] = 0
                word = item.get('word', '').lower()
                if word not in unique_words:
                    unique_words[word] = item
                    
            new_data = get_empty_data()
            new_data["TOEIC"]["words"] = list(unique_words.values())
            new_data["TOEIC"]["historyUrls"] = old_history
            return new_data, True
            
    # If it's already the new format, just ensure all scenarios exist
    new_data = data
    for scenario in ["TOEIC", "GEPT", "Daily"]:
        if scenario not in new_data:
            new_data[scenario] = {"words": [], "historyUrls": []}
            needs_save = True
        else:
            if "words" not in new_data[scenario]:
                new_data[scenario]["words"] = []
                needs_save = True
            if "historyUrls" not in new_data[scenario]:
                new_data[scenario]["historyUrls"] = []
                needs_save = True
                
            # Check for missing status in new format
            for item in new_data[scenario].get("words", []):
                if "status" not in item:
                    item["status"] = 0
                    needs_save = True
                    
    return new_data, needs_save

from dotenv import load_dotenv
import requests

load_dotenv()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GIST_ID = os.getenv("GIST_ID")

def load_data():
    if not GITHUB_TOKEN or not GIST_ID:
        print("Missing GITHUB_TOKEN or GIST_ID, falling back to empty dict")
        return get_empty_data()

    try:
        headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
        res = requests.get(f"https://api.github.com/gists/{GIST_ID}", headers=headers)
        if res.status_code == 200:
            gist_data = res.json()
            content = gist_data['files']['data.json']['content']
            data = json.loads(content)
            data, needs_save = migrate_data(data)
            if needs_save:
                save_data(data)
            return data
    except Exception as e:
        print(f"Error loading from gist: {e}")
    return get_empty_data()

def save_data(data):
    if not GITHUB_TOKEN or not GIST_ID:
        print("Missing GITHUB_TOKEN or GIST_ID, cannot save data")
        return

    try:
        headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
        payload = {
            "files": {
                "data.json": {
                    "content": json.dumps(data, ensure_ascii=False, indent=2)
                }
            }
        }
        res = requests.patch(f"https://api.github.com/gists/{GIST_ID}", headers=headers, json=payload)
        if res.status_code != 200:
            print(f"Error saving to gist: {res.text}")
    except Exception as e:
        print(f"Error saving to gist: {e}")

def merge_words(existing_list, new_list):
    """Appends new words to existing_list only if they don't already exist (case-insensitive)."""
    existing_words = {w.get('word', '').lower() for w in existing_list}
    for item in new_list:
        word = item.get('word', '').lower()
        if word not in existing_words:
            if 'status' not in item:
                item['status'] = 0
            existing_list.append(item)
            existing_words.add(word)

def build_prompt(content_source: str, is_youtube: bool, scenario: str) -> str:
    scenario_desc = {
        "TOEIC": "多益 (TOEIC) 考試",
        "GEPT": "全民英檢中高級 (GEPT High-Intermediate)",
        "Daily": "日常實用英語"
    }.get(scenario, "多益 (TOEIC) 考試")
    
    if is_youtube:
        source_desc = f"這可能是一般的英聽訓練影片或是單字教學影片。以下是我提供的 YouTube 影片逐字稿：\n{content_source}\n請從整段逐字稿中，全面萃取出所有符合目標情境的必考與重要單字（包含影片中出現的好單字以及例句內的單字）。"
    else:
        source_desc = f"以下是我提供的手動單字列表：\n{content_source}\n請為這些單字生成資料。"
    
    return f"""
    你是一位精通 {scenario_desc} 的英語教學專家。
    {source_desc}

    請將這些單字整理成結構化、高效率的學習卡片資料。

    ### 整理規範與步驟：
    1. **目標情境**：產出的「常見考法/情境」、「實戰例句」必須完全符合【{scenario_desc}】的風格。
    2. **目標分級標記 (level)**：
       * 650：基礎與高頻核心字。
       * 750：中高階進階字。
       * 900：高分衝刺與專業情境字。
    3. **高頻搭配 (collocations)**：必須包含中文翻譯，例如："front desk receptionist (櫃檯接待員)"
    4. **出題重點 (examFocus)**：如有需要，請提供額外的重點（選填），可以包含以下屬性：
       * `grammar`: 文法重點 (如 "an opening 空缺是可數名詞")
       * `synonyms`: 常考同義詞 (如 "vacancy")
       * `phrases`: 常考語句 (如 "complete an application")
       * `confusingWords`: 易混淆單字 (如 "applicant vs application")

    ### 請將結果輸出為 JSON 格式，必須嚴格遵守以下結構:
    {{
        "words": [
            {{
                "word": "單字本身",
                "pos": "詞性 (例如 n., v., adj.)",
                "meaning": "中文意思",
                "level": 650 或 750 或 900,
                "context": "{scenario_desc} 常見考法或情境說明",
                "core": "核心意思",
                "collocations": ["搭配詞1 (中文意思)", "搭配詞2 (中文意思)"],
                "exEn": "英文實戰例句，請將目標單字加上 <strong> 標籤",
                "exZh": "中文實戰例句，請將目標單字加上 <strong> 標籤",
                "examFocus": {{
                    "grammar": "文法說明 (可選)",
                    "synonyms": "同義詞說明 (可選)",
                    "phrases": "常考語句說明 (可選)",
                    "confusingWords": "易混淆單字說明 (可選)"
                }}
            }}
        ]
    }}
    """

def call_gemini(api_key: str, prompt: str):
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        ),
    )
    return json.loads(response.text)

@app.get("/api/words")
def get_words():
    return load_data()

@app.post("/api/clear_data")
def clear_data(req: ClearDataRequest):
    data = load_data()
    if req.scenario in data:
        data[req.scenario] = {"words": [], "historyUrls": []}
        save_data(data)
    return {"status": "success", "message": "Data cleared successfully"}

@app.post("/api/update_status")
def update_status(req: UpdateStatusRequest):
    data = load_data()
    word_found = False
    
    scenario_data = data.get(req.scenario, {"words": []})
    for item in scenario_data.get("words", []):
        if item.get('word', '').lower() == req.word.lower():
            item['status'] = req.status
            word_found = True
            break
    
    if word_found:
        save_data(data)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="Word not found")

@app.post("/api/generate")
def generate_cards(req: GenerateRequest):
    video_id = get_video_id(req.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    try:
        ytt_api = YouTubeTranscriptApi()
        transcript_list = ytt_api.list(video_id)
        try:
            transcript = transcript_list.find_transcript(['zh-TW', 'zh-HK', 'zh', 'en'])
        except:
            transcript = next(iter(transcript_list))
        
        text_lines = [getattr(item, 'text', str(item)) for item in transcript.fetch()]
        full_transcript = "\n".join(text_lines)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch transcript: {str(e)}")
        
    if not full_transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty")

    try:
        prompt = build_prompt(full_transcript, is_youtube=True, scenario=req.scenario)
        result_json = call_gemini(req.api_key, prompt)
        
        current_data = load_data()
        scenario_data = current_data.setdefault(req.scenario, {"words": [], "historyUrls": []})
        
        merge_words(scenario_data['words'], result_json.get('words', []))
        
        # Add to history if not exists
        if req.url not in scenario_data.get('historyUrls', []):
            scenario_data.setdefault('historyUrls', []).append(req.url)
            
        save_data(current_data)
        return {"status": "success", "message": "Words generated and saved successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process with Gemini API: {str(e)}")

@app.post("/api/generate_manual")
def generate_manual_cards(req: ManualGenerateRequest):
    if not req.words.strip():
        raise HTTPException(status_code=400, detail="No words provided")
        
    try:
        prompt = build_prompt(req.words, is_youtube=False, scenario=req.scenario)
        result_json = call_gemini(req.api_key, prompt)
        
        current_data = load_data()
        scenario_data = current_data.setdefault(req.scenario, {"words": [], "historyUrls": []})
        
        merge_words(scenario_data['words'], result_json.get('words', []))
        save_data(current_data)
        return {"status": "success", "message": "Manual words generated and saved successfully!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process with Gemini API: {str(e)}")

# Mount static files
app.mount("/assets", StaticFiles(directory="."), name="assets")

@app.get("/")
def read_root():
    return FileResponse("index.html")

@app.get("/{filename}")
def read_file(filename: str):
    if os.path.exists(filename):
        return FileResponse(filename)
    raise HTTPException(status_code=404)
