.PHONY: dev test seed install lint

install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

dev:
	@echo "Starting development environment with Docker..."
	docker compose up --build

dev-local-backend:
	cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

dev-local-worker:
	cd backend && arq app.workers.worker.WorkerSettings

dev-local-frontend:
	cd frontend && npm run dev

seed:
	cd backend && python -m app.scripts.seed

test:
	cd backend && python -m pytest -v
