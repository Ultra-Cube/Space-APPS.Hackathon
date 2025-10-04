# Deployment Guide

> **Built by the Ultra Cube Team for the NASA Space Apps Challenge 2025.**

## Local Development

### Quick Start
```bash
# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn app:app --reload --port 8000

# Access interface
# Open browser to http://localhost:8000
```

## Production Deployment

### Option 1: Simple Production Server

```bash
# Install dependencies
pip install -r requirements.txt

# Run with production settings
uvicorn app:app --host 0.0.0.0 --port 8000 --workers 4
```

### Option 2: Behind Nginx

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Start FastAPI:**
```bash
uvicorn app:app --host 127.0.0.1 --port 8000 --workers 4
```

### Option 3: Docker

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Build and Run:**
```bash
docker build -t spacebio-search .
docker run -p 8000:8000 -v $(pwd)/data:/app/data spacebio-search
```

### Option 4: Cloud Platforms

#### Heroku
```bash
# Create Procfile
echo "web: uvicorn app:app --host=0.0.0.0 --port=${PORT}" > Procfile

# Deploy
heroku create your-app-name
git push heroku main
```

#### Google Cloud Run
```bash
gcloud run deploy spacebio-search \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### AWS EC2
```bash
# SSH into EC2 instance
ssh -i key.pem ubuntu@your-instance-ip

# Install dependencies
sudo apt update
sudo apt install python3-pip
pip3 install -r requirements.txt

# Run with screen or tmux
screen -S spacebio
uvicorn app:app --host 0.0.0.0 --port 8000

# Detach with Ctrl+A, D
```

## Security Considerations

### 1. CORS Configuration

For production, update `app.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-domain.com"],  # Specific domain
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

### 2. HTTPS

Always use HTTPS in production:
- Use Let's Encrypt with Certbot
- Configure SSL certificates in Nginx
- Use cloud platform SSL features

### 3. Rate Limiting

Add rate limiting to prevent abuse:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.get("/search")
@limiter.limit("10/minute")
def search(...):
    ...
```

### 4. Environment Variables

Use environment variables for configuration:
```python
import os

DATA_DIR = os.getenv("DATA_DIR", "data")
EMB_MODEL = os.getenv("EMB_MODEL", "sentence-transformers/all-mpnet-base-v2")
```

## Performance Optimization

### 1. Caching

Add response caching:
```python
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

@app.on_event("startup")
async def startup():
    FastAPICache.init(InMemoryBackend())
```

### 2. CDN for Frontend

Host static files on a CDN:
- CloudFlare
- AWS CloudFront
- Google Cloud CDN

### 3. Database Optimization

For large datasets:
- Use persistent FAISS index
- Implement index sharding
- Add query result caching

### 4. Load Balancing

Use multiple workers:
```bash
uvicorn app:app --workers 4 --worker-class uvicorn.workers.UvicornWorker
```

## Monitoring

### 1. Application Logs

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)
```

### 2. Health Checks

The `/health` endpoint is suitable for monitoring:
```bash
# Check every minute
* * * * * curl http://localhost:8000/health || alert-system
```

### 3. Metrics

Add Prometheus metrics:
```python
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)
```

## Backup and Recovery

### Data Backup

```bash
# Backup data directory
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Upload to cloud storage
aws s3 cp backup-*.tar.gz s3://your-bucket/backups/
```

### Recovery

```bash
# Download and extract backup
aws s3 cp s3://your-bucket/backups/backup-20231004.tar.gz .
tar -xzf backup-20231004.tar.gz
```

## Scaling

### Horizontal Scaling

1. Deploy multiple instances behind a load balancer
2. Share data directory via NFS or S3
3. Use Redis for distributed caching

### Vertical Scaling

1. Increase server RAM for larger indexes
2. Use GPU for faster embedding generation
3. Add more CPU cores for parallel processing

## Troubleshooting

### Issue: High Memory Usage

**Solution:**
- Use FAISS with memory mapping
- Reduce number of workers
- Implement pagination

### Issue: Slow Initial Load

**Solution:**
- Pre-load model at startup
- Use model caching
- Consider smaller embedding models

### Issue: Frontend Not Loading

**Solution:**
- Check `frontend/` directory exists
- Verify file permissions
- Check server logs for errors

## Maintenance

### Regular Tasks

1. **Update Dependencies**
   ```bash
   pip list --outdated
   pip install -U package-name
   ```

2. **Clean Logs**
   ```bash
   find /var/log -name "*.log" -mtime +30 -delete
   ```

3. **Monitor Disk Space**
   ```bash
   df -h
   ```

4. **Check Health**
   ```bash
   curl http://localhost:8000/health
   ```

## Support

For production support:
- Monitor error logs
- Set up alerting
- Have backup deployment ready
- Document all configuration
- Keep dependencies updated

---

**Recommended for Production:**
- Ubuntu 22.04 LTS or newer
- Python 3.11+
- Nginx as reverse proxy
- SSL/TLS certificates
- Regular backups
- Monitoring and alerting
