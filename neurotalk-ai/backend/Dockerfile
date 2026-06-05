FROM python:3.11

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend
COPY ml/ ./ml

EXPOSE 7860

WORKDIR /app/backend

CMD ["python", "app.py"]