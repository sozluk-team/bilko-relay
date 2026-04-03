# bilko-relay

Discord webhook relay servisi.

Bu servis, istemciden gelen JSON payload'ını bir Discord webhook'una iletir. Relay endpoint'i token ile korunur ve Discord webhook URL'si uygulama tarafında `.env` üzerinden saklanır.

## Gereksinimler

- Node.js 20+
- npm
- İsteğe bağlı: Docker ve Docker Compose

## Ortam Değişkenleri

Örnek dosya: `.env.example`

Gerekli alanlar:

```env
HOST=0.0.0.0
PORT=31312
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token
RELAY_TOKEN=replace-with-a-long-random-token
```

## Kurulum

`.env.example` dosyasını `.env` olarak kopyalayın ve gerçek değerlerle doldurun.

```bash
npm install
npm start
```

Servis varsayılan olarak `http://0.0.0.0:31312` üzerinde çalışır.

## Docker ile Çalıştırma

```bash
docker compose up -d --build
```

`docker-compose.yml` dosyası `.env` dosyasını otomatik olarak yükler.

Not: Compose içinde kullanılan `web` network'ü external olarak tanımlıdır. Yoksa önce oluşturmanız gerekir:

```bash
docker network create web
```

## API

### Sağlık kontrolü

```http
GET /
```

Örnek yanıt:

```json
{
  "ok": true
}
```

### Relay endpoint

```http
POST /relay
Content-Type: application/json
x-relay-token: <RELAY_TOKEN>
```

Örnek istek:

```bash
curl -X POST http://localhost:31312/relay \
  -H "Content-Type: application/json" \
  -H "x-relay-token: your-token" \
  -d '{
    "content": "hello from bilko-relay"
  }'
```

Başarılı yanıt:

```json
{
  "ok": true,
  "status": 204
}
```

## Güvenlik Notları

- `.env` dosyasını git'e eklemeyin. Repo içinde sadece `.env.example` tutulur.
- `RELAY_TOKEN` uzun ve rastgele bir değer olmalıdır.
- `DISCORD_WEBHOOK_URL` daha önce açık ortama düştüyse Discord tarafında rotate edilmelidir.
- Relay yalnızca Discord webhook formatındaki HTTPS URL'lerini kabul eder.
- Büyük veya bozuk JSON istekleri sınırlanır ve reddedilir.

## Geliştirme Notları

- Uygulama `dotenv` ile `.env` yükler.
- Container içinde süreç `node` kullanıcısı ile çalışır.
- Docker build sırasında `.env` ve `node_modules` image içine kopyalanmaz.
