# E-Commerce Website — Vaha Ruchulu

[![Live Site](https://img.shields.io/badge/Live-vaha--ruchulu.vercel.app-0B4F2A?style=for-the-badge)](https://vaha-ruchulu.vercel.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000?style=flat-square&logo=vercel)](https://vercel.com)

Homemade Andhra **pickles, podis & karams** — full customer e-commerce website with WhatsApp ordering and owner admin dashboard.

**Live demo:** https://vaha-ruchulu.vercel.app

---

## Features

### Customer
- Product catalog with categories, search, and weight options (250g / 500g / 1 KG)
- Shopping cart and WhatsApp order placement
- Order tracking (Order ID + phone)
- Customer reviews

### Owner dashboard
- Manage orders (confirm payment, preparing, shipped, delivered)
- Reply to and moderate reviews
- **Inventory** — add, edit, remove products, upload photos, mark out of stock

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite |
| Backend | Vercel Serverless Functions |
| Storage | Vercel Blob |
| Deploy | Vercel |
| Alerts | Gmail, Telegram (optional) |

---

## Run locally

```bash
git clone https://github.com/SAIKIRAN0035/e-commerce-website.git
cd e-commerce-website
npm install
npm run dev
```

For API routes locally:

```bash
npx vercel dev
```

Copy `.env.example` to `.env.local` and set environment variables for full features.

---

## Environment variables

See [`.env.example`](.env.example) for:

- `REVIEWS_ADMIN_PASSWORD` — owner login
- `BLOB_READ_WRITE_TOKEN` — reviews, orders, products storage
- `GMAIL_*` — order email alerts
- `TELEGRAM_*` — instant order notifications

---

## Deploy

```bash
npm run build
npx vercel --prod
```

---

## Author

**Saikiran Reddy Yarava** · [GitHub](https://github.com/SAIKIRAN0035) · [Portfolio](https://github.com/SAIKIRAN0035/saikiran-portfolio)
