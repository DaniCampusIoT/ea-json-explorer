FROM python:3.11-slim

WORKDIR /app

# bust cache 2026-08-06b
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONUNBUFFERED=1

CMD ["python", "start.py"]
