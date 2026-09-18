# Open WebUI me PostgreSQL lokal

Ky konfigurim eshte per testim ne PC. `docker-compose.local-postgres.yaml`
nis Open WebUI dhe nje PostgreSQL te vecante brenda Docker. PostgreSQL nuk
ekspozohet ne rrjet; vetem Open WebUI hapet te `http://localhost:8081`.

## Nisja ne Windows PowerShell

Nga dosja e ketij projekti:

```powershell
Copy-Item postgres.local.env.example .env.local
notepad .env.local
```

Zevendeso dy vlerat `REPLACE_WITH...` me dy vlera te ndryshme, te gjata,
hekzadecimale (vetem `0-9` dhe `a-f`). Mos i dergo ne chat ose ne GitHub.
Per te gjeneruar secilen vlere ne PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
([BitConverter]::ToString($bytes)).Replace('-', '').ToLower()
```

Ekzekuto bllokun dy here, nje here per secilen vlere. Pastaj:

```powershell
docker compose --env-file .env.local -f docker-compose.local-postgres.yaml up -d --build
```

Hap `http://localhost:8081` dhe krijo nje llogari prove. Verifiko qe
regjistrimi u ruajt ne PostgreSQL:

```powershell
docker compose --env-file .env.local -f docker-compose.local-postgres.yaml exec -T postgres psql -U openwebui -d openwebui -c 'SELECT COUNT(*) FROM "user";'
```

Rezultati duhet te rritet pas regjistrimit. Volumi
`open-webui-local-postgres-data` ruan databazen ndermjet rinisjeve;
`open-webui-local-data` ruan skedaret e ngarkuar/cache. Mos i fshi volumet.

Ky eshte nje instalim i ri: nuk importon automatikisht perdoruesit qe jane
regjistruar tashme te faqja ne Dokploy. Para kalimit perfundimtar ne server,
vendos nese do t'i ruash ato llogari dhe bej backup/migrim te databazes se
tyre. Per serverin, perdor nje PostgreSQL te aksesueshem nga Dokploy dhe
konfiguro `DATABASE_URL` sipas `DOKPLOY.md`; PostgreSQL lokal i PC-se nuk
duhet te perdoret si databaze prodhimi.
