from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag import get_answer

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], #restrict this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    video_url:str
    query:str
    

@app.post("/chat")
async def chat(request: ChatRequest):
    answer = get_answer(request.video_url, request.query)
    return {"answer": answer}

@app.get("/")
async def root():
    return {"message": "Welcome to the YouTube AI Chatbot API!"}