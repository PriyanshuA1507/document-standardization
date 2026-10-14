FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for python-magic and file conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends libmagic1 curl libreoffice-writer-nogui && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies (supports local pre-downloaded wheel directory if provided)
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefer-binary --no-compile --find-links=/app/wheels -r requirements.txt


# Copy application code
COPY . .

# Make entrypoint executable (strip Windows line-endings if present)
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

# Create storage directory
RUN mkdir -p /storage/reports

EXPOSE 8002

ENTRYPOINT ["./entrypoint.sh"]
