# Deploy ne Dokploy

Ky projekt mund te deploy-ohet ne `Dokploy` duke perdorur file-in `docker-compose.dokploy.yaml`.

## Opsioni i rekomanduar

Ky konfigurim nis dy sherbime:

- `open-webui`
- `ollama`

`Open WebUI` lidhet me `Ollama` permes rrjetit te brendshem Docker me adresen:

```text
http://ollama:11434
```

## File qe duhet perdorur ne Dokploy

Per `Docker Compose deployment`, perdor:

```text
docker-compose.dokploy.yaml
```

## Variablat e ambientit

Ne `Dokploy`, shto te pakten kete variable:

```text
WEBUI_SECRET_KEY=vendos-nje-secret-te-forte-ketu
```

Shembull:

```text
WEBUI_SECRET_KEY=farsh-openwebui-2026-secret-key
```

## Porti

Sherbimi `open-webui` ekspozon:

```text
3000
```

Brenda container-it aplikacioni punon ne:

```text
8080
```

## Hapat ne Dokploy

1. Krijo nje projekt te ri ne `Dokploy`.
2. Zgjidh `Compose`.
3. Lidh repository-n ose ngarko kodin e projektit.
4. Zgjidh file-in `docker-compose.dokploy.yaml`.
5. Shto variablen `WEBUI_SECRET_KEY`.
6. Vendos domain-in tend.
7. Deploy.

## Domain dhe proxy

Nese `Dokploy` perdor reverse proxy, drejtoje trafikun te sherbimi `open-webui` ne portin `3000`.

## Persistenca e te dhenave

Konfigurimi ruan te dhenat ne volume Docker:

- `open-webui-data`
- `ollama-data`

Kjo do te thote se:

- databaza e `Open WebUI` ruhet pas restart-it
- modelet e `Ollama` ruhen pas restart-it

## Nese do te perdoresh Ollama jashte Dokploy

Nese ke nje server tjeter me `Ollama`, mund te ndryshosh:

```yaml
OLLAMA_BASE_URL: http://ollama:11434
```

ne:

```yaml
OLLAMA_BASE_URL: http://IP-OSE-DOMAIN-I-OLLAMA:11434
```

Ne ate rast mund ta heqesh fare sherbimin `ollama` nga compose.
