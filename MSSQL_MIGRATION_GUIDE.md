# MSSQL Migration Guide

Bu dokümantasyon, projenizi SQLite'dan MSSQL'e nasıl migrate edeceğinizi adım adım açıklar.

## 📋 Ön Koşullar

- Docker Desktop kurulu ve çalışır durumda
- Node.js ve npm kurulu
- Proje bağımlılıkları yüklenmiş (`npm install`)

## 🚀 Adım 1: Docker ile MSSQL Başlatma

### 1.1 Docker Container'ı Başlat

Proje kök dizininde terminal açın ve:

```bash
docker-compose up -d
```

Bu komut:
- Microsoft SQL Server 2022'yi Docker'da başlatır
- Port 1433'ü açar
- Verileri kalıcı volume'de saklar
- Healthcheck ile otomatik kontrol yapar

### 1.2 Container Durumunu Kontrol

```bash
docker ps
```

`salescoach-mssql` container'ının **healthy** durumunda olduğunu görmelisiniz.

### 1.3 MSSQL'e Bağlan ve Veritabanı Oluştur

```bash
docker exec -it salescoach-mssql /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P "YourStrong!Password123"
```

SQL prompt'unda şu komutları çalıştırın:

```sql
CREATE DATABASE SalesCoach;
GO

USE SalesCoach;
GO

SELECT name FROM sys.databases;
GO

EXIT
```

## 🔧 Adım 2: Environment Variables Ayarlama

`.env` dosyanızın doğru olduğundan emin olun:

```env
# MSSQL Database Configuration
MSSQL_SA_PASSWORD=YourStrong!Password123
DATABASE_URL="sqlserver://localhost:1433;database=SalesCoach;user=sa;password=YourStrong!Password123;encrypt=false;trustServerCertificate=true"

# JWT Secret
JWT_SECRET=bbkJBxZfjUH+uSRkleA+xS4WU2UlX9n4IaJFMes/r0A=

# Azure OpenAI (Değerlendirme için)
AZURE_OPENAI_ENDPOINT=your_endpoint_here
AZURE_OPENAI_API_KEY=your_key_here
AZURE_OPENAI_DEPLOYMENT=your_deployment_here
```

## 📊 Adım 3: Prisma Migration

### 3.1 Mevcut SQLite Verilerinizi Yedekleyin (Opsiyonel)

```bash
cp prisma/dev.db prisma/dev.db.backup
```

### 3.2 Prisma Client'ı Yeniden Oluştur

```bash
npx prisma generate
```

Bu komut, Prisma schema'nızdaki `provider = "sqlserver"` ayarına göre client oluşturur.

### 3.3 Migration Oluştur ve Uygula

**Geliştirme Ortamı için:**

```bash
npx prisma migrate dev --name init_mssql
```

Bu komut:
1. Mevcut schema'ya göre migration dosyası oluşturur
2. Migration'ı MSSQL veritabanına uygular
3. Prisma Client'ı yeniden oluşturur

**Production Ortamı için:**

```bash
npx prisma migrate deploy
```

### 3.4 Migration'ı Doğrula

```bash
npx prisma studio
```

Prisma Studio açılır ve MSSQL veritabanınızdaki tabloları görüntüleyebilirsiniz.

## 🔄 Adım 4: Veri Taşıma (Opsiyonel)

Eğer SQLite'daki mevcut verilerinizi MSSQL'e taşımak istiyorsanız:

### 4.1 SQLite Verilerini Export Et

```bash
npx prisma db pull --schema=prisma/schema.sqlite.prisma
```

### 4.2 Manuel Veri Transferi

Küçük veri setleri için Prisma Studio kullanabilir veya bir migration script yazabilirsiniz:

```typescript
// migrate-data.ts
import { PrismaClient as SQLiteClient } from '@prisma/client';
import { PrismaClient as MSSQLClient } from '@prisma/client';

const sqlite = new SQLiteClient({ datasources: { db: { url: 'file:./dev.db' } } });
const mssql = new MSSQLClient();

async function migrateData() {
  // Users
  const users = await sqlite.user.findMany();
  for (const user of users) {
    await mssql.user.create({ data: user });
  }
  
  // Sessions
  const sessions = await sqlite.session.findMany();
  for (const session of sessions) {
    await mssql.session.create({ data: session });
  }
  
  // ... diğer tablolar
  
  console.log('Migration completed!');
}

migrateData();
```

## 🧪 Adım 5: Uygulamayı Test Etme

### 5.1 Backend'i Başlat

```bash
npm run dev
```

### 5.2 Bağlantıyı Test Et

Backend loglarında şunu görmelisiniz:

```
Server running on port 3000
Database connected successfully
```

### 5.3 Kullanıcı Kaydı Testi

Tarayıcınızda `http://localhost:5000/login.html` adresini açın ve yeni bir hesap oluşturun.

## 🛠️ Sorun Giderme

### Problem 1: "Cannot connect to database"

**Çözüm:**
- Docker container'ının çalıştığından emin olun: `docker ps`
- MSSQL loglarını kontrol edin: `docker logs salescoach-mssql`
- Connection string'in doğru olduğunu kontrol edin

### Problem 2: "Prisma schema validation failed"

**Çözüm:**
- `prisma/schema.prisma` dosyasındaki `provider = "sqlserver"` olduğundan emin olun
- `npx prisma validate` komutuyla schema'yı kontrol edin

### Problem 3: Migration hatası

**Çözüm:**
```bash
# Migration'ları sıfırla
npx prisma migrate reset

# Yeniden migration oluştur
npx prisma migrate dev --name init_mssql
```

### Problem 4: "Login attempts failed"

**Çözüm:**
- MSSQL veritabanında User tablosunun oluşturulduğunu kontrol edin
- Backend loglarını kontrol edin
- Tarayıcı console'unda hata mesajlarını kontrol edin

## 📝 Önemli Notlar

### Connection String Formatı

MSSQL için connection string formatı şöyledir:

```
sqlserver://[host][:port];database=[database];user=[user];password=[password];[options]
```

Örnek:
```
sqlserver://localhost:1433;database=SalesCoach;user=sa;password=YourStrong!Password123;encrypt=false;trustServerCertificate=true
```

### Veri Tipleri

SQLite'dan MSSQL'e geçerken bazı veri tipleri değişir:

- `TEXT` → `NVARCHAR(MAX)` (Prisma: `@db.NVarChar(Max)`)
- `INTEGER` → `INT`
- `REAL` → `FLOAT`
- `BLOB` → `VARBINARY(MAX)`

### Performans İpuçları

1. **Index'leri Kullanın**: Prisma schema'da `@@index` kullanın
2. **Connection Pooling**: Production'da connection pool ayarlarını optimize edin
3. **Backup**: Düzenli otomatik backup ayarlayın

## 🔒 Güvenlik

### Production İçin Öneriler

1. **Güçlü Şifreler Kullanın**:
   ```sql
   ALTER LOGIN sa WITH PASSWORD = 'YourVeryStrongPassword123!@#$%';
   ```

2. **Farklı Kullanıcı Oluşturun** (SA kullanmayın):
   ```sql
   CREATE LOGIN salescoach_user WITH PASSWORD = 'StrongPassword123!';
   CREATE USER salescoach_user FOR LOGIN salescoach_user;
   ALTER ROLE db_owner ADD MEMBER salescoach_user;
   ```

3. **Encryption Etkinleştirin**:
   ```
   encrypt=true;trustServerCertificate=false
   ```

4. **Firewall Kuralları**: Sadece gerekli IP'lere erişim verin

## 📚 Ek Kaynaklar

- [Prisma SQL Server Documentation](https://www.prisma.io/docs/concepts/database-connectors/sql-server)
- [Azure SQL Database Migration](https://learn.microsoft.com/en-us/azure/azure-sql/migration-guides/)
- [Docker MSSQL Documentation](https://hub.docker.com/_/microsoft-mssql-server)

## ✅ Checklist

Migration tamamlandıktan sonra kontrol edin:

- [ ] Docker container çalışıyor
- [ ] SalesCoach veritabanı oluşturuldu
- [ ] Prisma migrations uygulandı
- [ ] Tüm tablolar oluşturuldu
- [ ] Backend başarıyla çalışıyor
- [ ] Kullanıcı kaydı yapılabiliyor
- [ ] Login başarılı
- [ ] Session oluşturuluyor
- [ ] Evaluation kaydediliyor

Tebrikler! MSSQL migration'ınız tamamlandı! 🎉
