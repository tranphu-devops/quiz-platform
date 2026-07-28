# NovaQuiz

*[English](README.md) · [Tiếng Việt](README.vi.md)*

マイクロサービス構成で構築されたオンライン試験プラットフォーム(試験の作成・公開・受験)。単一の PostgreSQL インスタンス(サービスごとに専用スキーマ)、単一の Nginx イングレス、認証は GoTrue(メール/パスワード + Google OAuth)。

## サービス一覧

| サービス | Docker ポート | 開発ポート | 説明 |
|---|---|---|---|
| GoTrue (SSO) | 9999 | 9999 | サインアップ / ログイン / Google OAuth / JWT 発行 |
| user-service | 3002 | 4002 | プロフィール、画像アップロード(S3)、クレジット、管理設定、Teacher API キー |
| exam-service | 3003 | 4003 | 試験、問題、コレクション |
| submission-service | 3004 | 4004 | 提出、採点、1 デバイス限定の受験セッション |
| interaction-service | 3005 | 4005 | コメント / いいね / エラー報告 |
| generator-service | 3006 | 4006 | アップロードした資料(PDF/DOCX/text)から AI が試験を自動生成 |
| notification-service | 3007 | 4007 | 管理者アラート + ユーザーごとのアクティビティ通知(Email/Pushover/Telegram) |
| grader-service | — | — | 15 分ごとのバッチワーカー。期限切れの受験を自動採点(HTTP サーバーなし) |
| migrate | — | — | DB マイグレーションを適用して終了する一回限りのジョブ。全サービスがこれを待機 |
| frontend | 3000 | 4000 | SvelteKit 5 SPA(SSR 無効) |
| nginx | 80 | 80 | リバースプロキシ / 唯一のイングレス |

> `apps/auth-service/` は旧プロトタイプで Compose/Nginx に組み込まれていません — 無視してください。

## クイックスタート

**前提条件:** Docker, Docker Compose

```bash
cp .env.example .env
# 最低限これらを設定: POSTGRES_PASSWORD, JWT_SECRET (32文字以上),
# INTERNAL_API_KEY (32文字以上), SITE_URL, 各 *_DATABASE_URL

docker compose up --build
```

アクセス: http://localhost

DB スキーマは `migrate` サービスが `up` のたびに**自動適用**します(手動で `psql` を実行する必要はありません)。詳細は [CLAUDE.md](CLAUDE.md#database-migrations-automatic) を参照してください。

## 開発(ホットリロード)

`docker-compose.override.yml` は `docker compose up` 実行時に自動的に適用されます。内容:
- 各サービスの `src/` をマウントし `node --watch` でホットリロード
- ホスト側に追加ポートを公開(4000–4007, 9999, 5432, 6379)

## curl での簡易テスト

```bash
# サインアップ
curl -s -X POST http://localhost/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"123456","data":{"role":"teacher"}}' | jq

# ログイン → トークン取得
TOKEN=$(curl -s -X POST http://localhost/auth/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"123456"}' | jq -r '.access_token')

# 試験を作成
curl -s -X POST http://localhost/api/exams/exams \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Exam","time_limit":30,"credit_cost":0}' | jq

# ヘルスチェック
curl http://localhost/auth/health
curl http://localhost/api/exams/health
curl http://localhost/api/users/health
curl http://localhost/api/submissions/health
curl http://localhost/api/interactions/health
curl http://localhost/api/generator/health
curl http://localhost/api/notifications/health
```

## 主な機能

- **試験作成**: 4 ステップのウィザード、JSON からの問題インポート、カバー画像・問題ごとの画像、単一/複数選択問題、Markdown 形式の解説。
- **AI による試験生成**: 教師が資料(PDF/DOCX/text)を `/exams/generate` でアップロードすると、LLM(OpenRouter 経由)が選択式問題一式を自動作成し、レビュー用の下書き試験として保存。教師自身の LLM キー、または管理者が設定したプラットフォームキー(クレジット消費)を使用。
- **コレクション & バッジ**: 複数の試験をまとめて学習パスを作成。公開コレクション内の全試験に合格すると、受講生のプロフィールに自動でバッジが付与される。
- **クレジット制度**: 各試験にクレジットコストが設定され、受験開始時に消費される。デフォルト値は管理者が設定。紹介プログラム: 友人を招待すると、招待された側が教師にアップグレードするか有料アクションを完了した時点で双方にクレジットが付与される。
- **安全な受験セッション**: 1 回の受験につき 1 デバイスのみ(セッション UUID)、進捗の自動保存、再ログイン時の再開、制限時間超過時の自動採点(grader-service)、カウントダウン付きのスケジュール公開。
- **インタラクション**: コメント、いいね(受講生のみ)、受験完了後のエラー報告と、教師/管理者向けの対応受信箱。
- **試験の検索**: `/exams` ではタグでの絞り込み、並び替え(新着順 / 人気順)が可能で、各カードにいいね数・コメント数を表示。
- **公開プロフィール** (`/users/[id]`): 作成者の自己紹介、公開済み試験の一覧を表示。
- **マルチチャンネル通知**: 採点完了、コメントへの返信、報告の対応完了などの個人向けアクティビティ通知や、管理者/システム通知を Email(Resend)、Pushover、Telegram で受け取れる。イベント種別ごとに `/profile` で個別にオン/オフ可能。
- **Teacher API**: `/profile` で発行する長期有効な API キーにより、ブラウザセッションなしでスクリプトから試験を管理可能 — 詳細は `/api-docs`。
- **管理者向けシステム概要**: `/admin` で SSH 不要のサービス稼働状況・ログ・DB 統計(読み取り専用)を確認可能。

## 技術スタック

- **フロントエンド**: SvelteKit 5 + Node adapter + `@supabase/auth-js`(SSR 無効、SPA)
- **バックエンド**: Node.js 24 + Fastify + CASL(認可)
- **認証**: GoTrue(`supabase/gotrue:v2.151.0`)— JWT HS256、Google OAuth はオプション
- **データベース**: PostgreSQL 16(マルチスキーマ、番号付き・冪等なマイグレーション)
- **キャッシュ**: Redis(exam/user/interaction サービス向けの best-effort な読み取りキャッシュ)
- **ストレージ**: Lightsail / S3 互換オブジェクトストレージ(画像アップロード)
- **コンテナ**: Docker Compose + Nginx
- **レジストリ**: GitHub Container Registry(GHCR)
- **CI/CD**: GitHub Actions — マトリクスビルド(user / exam / submission / interaction / generator / notification / grader / frontend)、ビルド成功後にサーバーへ自動デプロイ

## ロール

| ロール | 権限 |
|---|---|
| `student` | 公開済み試験の閲覧・受験、自分の提出結果の閲覧、いいね & 試験の報告 |
| `teacher` | 自分の試験の CRUD、全提出結果の閲覧、自分の試験への報告への対応 |
| `admin` | フルアクセス |
| `banned` | 認証ミドルウェアで即ブロック(DB へのライブ確認) |

ロールはサインアップ時に `user_metadata.role` に設定され、JWT に埋め込まれます。アーキテクチャ/規約の詳細は [CLAUDE.md](CLAUDE.md)、デザインシステムは [DESIGN.md](DESIGN.md) を参照してください。
