# Aragon Notification Service
## Entities

![diagram](./db.svg)

## Config

### Start Postgres and create a DB and user
```
docker run -d -p 5433:5432 --name postgres postgres
docker exec -i -t postgres createuser -h localhost -U postgres --superuser aragon-notifications
docker exec -i -t postgres createdb -h localhost -U postgres --owner aragon-notifications notifications-service
```

### Env vars

Secrets are stored in `.env` file. For a list of required environment variables check `.env.example`

```
$ cp .env.example .env
# update .env with secrets 
```