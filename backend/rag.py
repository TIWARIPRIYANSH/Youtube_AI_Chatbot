from langchain_community.document_loaders import YoutubeLoader
from langchain_core.output_parsers import StrOutputParser
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.runnables import (
    RunnableLambda,
    RunnableParallel,
    RunnablePassthrough,
)
from dotenv import load_dotenv

load_dotenv()

# ---------------------------
# MAIN FUNCTION
# ---------------------------
video_cache = {}
def get_answer(video_url: str, query: str):

    # 1️⃣ Load Transcript
    if video_url not in video_cache:
        # Load transcript
        loader = YoutubeLoader.from_youtube_url(video_url, language="en")
        docs = loader.load()

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100
        )
        splitted_docs = splitter.split_documents(docs)

        embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

        vector_store = Chroma.from_documents(
            documents=splitted_docs,
            embedding=embeddings,
        )

        video_cache[video_url] = vector_store

    # Reuse stored vector DB
    retriever = video_cache[video_url].as_retriever(search_kwargs={"k": 3})

    # 3️⃣ Helper
    def join_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)

    # 4️⃣ Parallel Chain
    parallel_chain = RunnableParallel(
        context=retriever | RunnableLambda(join_docs),
        topic_input=RunnablePassthrough()
    )

    # 5️⃣ Prompt
    template = PromptTemplate(
        template="""You are a helpful and intelligent AI assistant.

You are answering questions about a YouTube video.

IMPORTANT RULES:
- Use ONLY the transcript context provided below.
- Do NOT use outside knowledge.
- Do NOT hallucinate or assume information.
- If the answer is not clearly mentioned in the transcript, say:
  "This information is not mentioned in the video transcript."
- Be precise and faithful to the transcript.
- Do not overwrite or invent details.
- If asked for a summary, summarize strictly based on the transcript.
- If asked whether a topic is discussed, clearly state whether it appears in the transcript and explain briefly using transcript evidence.

Transcript Context:
---------------------
{context}
---------------------

User Question:
{topic_input}

Answer clearly and concisely, based only on the transcript.
""",

        input_variables=["topic_input", "context"]
    )

    # 6️⃣ Model
    model = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
    parser = StrOutputParser()

    sequence_chain = template | model | parser

    # 7️⃣ Final Chain
    final_chain = parallel_chain | sequence_chain

    response = final_chain.invoke(query)

    return response.strip()