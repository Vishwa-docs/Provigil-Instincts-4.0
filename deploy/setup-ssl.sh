#!/bin/bash
# setup-ssl.sh — Run on EC2 after DNS propagates to provigilinstincts.click
# Usage: sudo bash setup-ssl.sh

set -e
DOMAIN="provigilinstincts.click"
EMAIL="admin@provigilinstincts.click"

echo "==> Stopping nginx container to free port 80..."
cd /home/ubuntu/provigil
docker compose -f docker-compose.prod.yml stop nginx

echo "==> Requesting Let's Encrypt certificate..."
certbot certonly --standalone \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos --email "$EMAIL" \
  --preferred-challenges http

echo "==> Certificate obtained. Activating SSL nginx config..."
cp /home/ubuntu/provigil/deploy/nginx-ssl.conf /home/ubuntu/provigil/deploy/nginx.conf

echo "==> Restarting all containers..."
docker compose -f docker-compose.prod.yml up -d

echo "==> Setting up auto-renewal cron..."
(crontab -l 2>/dev/null | grep -v certbot; echo "0 3 * * * certbot renew --pre-hook 'cd /home/ubuntu/provigil && docker compose -f docker-compose.prod.yml stop nginx' --post-hook 'cd /home/ubuntu/provigil && docker compose -f docker-compose.prod.yml start nginx' --quiet") | crontab -

echo "==> Done! https://$DOMAIN should be live."
