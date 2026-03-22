#!/usr/bin/env bash
# ProVigil EC2 Setup Script
# Run on a fresh Ubuntu 22.04 / Amazon Linux 2023 EC2 instance (t3.small recommended)
# Usage: chmod +x setup.sh && ./setup.sh

set -euo pipefail

echo "=== ProVigil EC2 Setup ==="

# Update system
echo "[1/5] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y 2>/dev/null || \
sudo yum update -y 2>/dev/null

# Install Docker
echo "[2/5] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    sudo systemctl enable docker
    sudo systemctl start docker
    echo "Docker installed. You may need to log out and back in for group changes."
fi

# Install Docker Compose
echo "[3/5] Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K[^"]+')
    sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Clone or verify repo
echo "[4/5] Verifying project files..."
if [ ! -f "docker-compose.prod.yml" ]; then
    echo "ERROR: Run this script from the ProVigil project root directory."
    echo "  cd /path/to/ProVigil-Instincts && ./deploy/setup.sh"
    exit 1
fi

# Create .env if missing
if [ ! -f ".env" ]; then
    echo "[!] No .env file found. Creating template..."
    cat > .env << 'EOF'
# Azure OpenAI
AZURE_OPENAI_API_KEY=your-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Email notifications
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Database
DATABASE_URL=sqlite:///./data/provigil.db
EOF
    echo "[!] Edit .env with your credentials before starting."
fi

# Create data directory
mkdir -p data

# Build and start
echo "[5/5] Building and starting ProVigil..."
sudo docker-compose -f docker-compose.prod.yml build
sudo docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "=== ProVigil is running ==="
echo "Dashboard:  http://$(curl -s ifconfig.me)"
echo "API:        http://$(curl -s ifconfig.me)/api/health"
echo ""
echo "Useful commands:"
echo "  docker-compose -f docker-compose.prod.yml logs -f    # View logs"
echo "  docker-compose -f docker-compose.prod.yml restart     # Restart"
echo "  docker-compose -f docker-compose.prod.yml down        # Stop"
