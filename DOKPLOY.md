# Deploy ne Dokploy me PostgreSQL

Compose file: `docker-compose.dokploy.yaml`. Ai nis `open-webui` ne portin e
brendshem `8080`. Databaza PostgreSQL duhet te jete e vecante dhe e aksesueshme
nga serveri Dokploy; ky Compose nuk krijon PostgreSQL lokal.

## Konfigurimi

Krijo nje databaze dhe perdorues PostgreSQL te dedikuar. Prefero rrjet privat
ose VPN; mos e ekspozo portin 5432 publikisht nese nuk eshte e nevojshme.

Te Dokploy, ne `Open Web UI` -> `Environment`, vendos:

```text
WEBUI_SECRET_KEY=VLER_EKZISTUESE_OSE_SECRET_I_FORTE
DATABASE_URL=postgresql://PERDORUESI:FJALEKALIMI@HOSTI:5432/EMRI_I_DATABAZES
```

Vlerat me siper jane vendmbajtes, jo kredenciale reale. Mos i ruaj
kredencialet ne GitHub ose ne screenshot-e. Nese PostgreSQL kerkon TLS, shto
`?sslmode=require` ne fund te URL-se. Karakteret speciale ne fjalekalim
duhen koduar ne URL. Ruaj vleren ekzistuese te `WEBUI_SECRET_KEY` gjate kalimit.

`DATABASE_URL` eshte e detyrueshme: Compose refuzon deploy-in nese mungon,
ne vend qe Open WebUI te kthehet pa dashje te SQLite. Docker image perfshin
driver-in PostgreSQL. Konfiguro domain-in e Dokploy per sherbimin `open-webui`
ne portin `8080`, pastaj bej deploy.

## Perdoruesit ekzistues

**Mos bej redeploy direkt nese ke llogari ekzistuese.** Nderrimi i
`DATABASE_URL` nuk i transferon automatikisht regjistrimet ose bisedat nga
`webui.db` ne PostgreSQL. Para kalimit:

1. Ndal regjistrimet/shkrimet dhe bej backup te volumit `open-webui-data`,
   vecanerisht `webui.db` dhe `uploads/`.
2. Migro databazen ekzistuese ne PostgreSQL dhe verifiko tabelat e
   autentifikimit, perdoruesit dhe bisedat. Mos kopjo vetem perdoruesit,
   sepse te dhenat kane lidhje me tabela te tjera.
3. Vendos `DATABASE_URL`, bej deploy dhe testo hyrjen me nje llogari
   ekzistuese, regjistrimin e nje llogarie prove dhe historikun e bisedave.
4. Mbaj backup-in e SQLite derisa te kesh verifikuar gjithcka.

Migrimi real kerkon akses te sigurt te dy databazave dhe nje dritare
mirembajtjeje. Ky ndryshim i Compose nuk ben migrim automatik.

## Cfare mbetet lokalisht

Volumi `open-webui-data` vazhdon te nevojitet per skedaret e ngarkuar dhe
cache-in. Regjistrimet, hash-et e fjalekalimeve, bisedat dhe metadatat e
aplikacionit do te ruhen ne PostgreSQL. Bej backup si te PostgreSQL ashtu
edhe te volumit te skedareve.

Lidhja me Ollama ose backend-in RAG konfigurohet vecmas nga databaza,
ne panelin e administratorit te Open WebUI.
