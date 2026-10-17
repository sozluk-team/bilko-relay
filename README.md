# bilko-relay

Discord webhook relay servisi.

Bu servis, istemciden gelen JSON payload'ını bir Discord webhook'una iletir. Birden fazla kaynağı (ör. bilko sözlük ve çankaya sözlük) aynı anda destekler: her kaynağın kendi token'ı ve kendi webhook'u vardır, istek hangi token ile gelirse o kaynağın webhook'una gider. Webhook URL'leri uygulama tarafında `.env` üzerinden saklanır.

## Gereksinimler

- Node.js 20+
- npm
- İsteğe bağlı: Docker ve Docker Compose

## Ortam Değişkenleri

Örnek dosya: `.env.example`

```env
HOST=0.0.0.0
PORT=31312

RELAY_SOURCES=bilko,cankaya

RELAY_BILKO_TOKEN=replace-with-a-long-random-token
RELAY_BILKO_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token

RELAY_CANKAYA_TOKEN=replace-with-another-long-random-token
RELAY_CANKAYA_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token
```

- `RELAY_SOURCES`: virgülle ayrılmış kaynak adları. Adlar küçük harf, rakam ve `-` içerebilir.
- `RELAY_<AD>_TOKEN`: kaynağın `x-relay-token` değeri. Her kaynağın token'ı farklı olmalıdır.
- `RELAY_<AD>_WEBHOOK_URL`: kaynağın Discord webhook URL'si.

Env adında kaynak adı büyük harfe çevrilir, `-` yerine `_` kullanılır: `cankaya-sozluk` → `RELAY_CANKAYA_SOZLUK_TOKEN`.

Eksik, hatalı veya iki kaynakta aynı olan bir değer varsa servis açılışta hangi değişken olduğunu söyleyerek durur.

### Yeni kaynak ekleme

1. `RELAY_SOURCES` listesine adı ekleyin (ör. `bilko,cankaya,tfl`).
2. `RELAY_TFL_TOKEN` (uzun, rastgele, diğerlerinden farklı) ve `RELAY_TFL_WEBHOOK_URL` değerlerini tanımlayın.
3. Servisi yeniden başlatın. Açılış logunda kaynak listesi görünür: `(sources: bilko, cankaya, tfl)`.
4. Sözlük tarafında `.env` içinde `DISCORD_RELAY_URL` ve `DISCORD_RELAY_TOKEN` değerlerini bu kaynağınkilerle doldurun.

### Tek webhook'lu eski kurulum

`RELAY_SOURCES` tanımlı değilse eski değişkenler kullanılır ve tek bir `default` kaynağı oluşur:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-id/your-webhook-token
RELAY_TOKEN=replace-with-a-long-random-token
```

Çoklu kuruluma geçerken `RELAY_TOKEN` değerini `RELAY_BILKO_TOKEN`, `DISCORD_WEBHOOK_URL` değerini `RELAY_BILKO_WEBHOOK_URL` olarak taşıyın ve eski iki satırı silin; bilko sözlük tarafında değişiklik gerekmez. `RELAY_SOURCES` ile eski değişkenler aynı anda tanımlıysa servis açılmaz.

## Kurulum

`.env.example` dosyasını `.env` olarak kopyalayın ve gerçek değerlerle doldurun.

```bash
npm install
npm start
```

Servis varsayılan olarak `http://0.0.0.0:31312` üzerinde çalışır.

Testler:

```bash
npm test
```

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

Bütün endpoint'ler `x-relay-token` başlığı ister. Token hiçbir kaynağa ait değilse `403` döner.

### Sağlık kontrolü

```http
GET /
x-relay-token: <kaynak token'ı>
```

Örnek yanıt (token'ın hangi kaynağa ait olduğunu da söyler):

```json
{
  "ok": true,
  "source": "cankaya"
}
```

### Relay endpoint

```http
POST /relay
POST /relay/<kaynak>
Content-Type: application/json
x-relay-token: <kaynak token'ı>
```

`/relay` kaynağı token'dan bulur. `/relay/<kaynak>` ise ek bir kontroldür: token o kaynağa ait değilse istek `403` ile reddedilir.

Örnek istek:

```bash
curl -X POST http://localhost:31312/relay/cankaya \
  -H "Content-Type: application/json" \
  -H "x-relay-token: cankaya-token" \
  -d '{
    "content": "hello from bilko-relay"
  }'
```

Başarılı yanıt:

```json
{
  "ok": true,
  "source": "cankaya",
  "status": 204
}
```

## Güvenlik Notları

- `.env` dosyasını git'e eklemeyin. Repo içinde sadece `.env.example` tutulur.
- Her kaynağın token'ı uzun, rastgele ve diğerlerinden farklı olmalıdır; bir kaynağın token'ı yalnızca kendi webhook'una yazabilir.
- Bir webhook URL'si daha önce açık ortama düştüyse Discord tarafında rotate edilmelidir.
- Relay yalnızca Discord webhook formatındaki HTTPS URL'lerini kabul eder.
- Token kontrolü JSON gövdesi okunmadan önce yapılır; büyük veya bozuk JSON istekleri sınırlanır ve reddedilir.

## Geliştirme Notları

- Uygulama `dotenv` ile `.env` yükler.
- `config.js` kaynakları env'den okur ve doğrular, `app.js` Express uygulamasını kurar, `index.js` ikisini birleştirip dinlemeye başlar.
- Container içinde süreç `node` kullanıcısı ile çalışır.
- Docker build sırasında `.env`, `node_modules` ve testler image içine kopyalanmaz.
