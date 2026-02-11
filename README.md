# Rōmy

[intel.getromy.app](https://intel.getromy.app)

**Rōmy** helps small nonprofits find new major donors at a fraction of the cost of existing solutions.

![Rōmy cover](./public/cover_zola.jpg)

## Features

- AI-powered prospect research with 22 data tools (SEC, FEC, ProPublica, USAspending, and more)
- Multi-model support via OpenRouter (Grok, and more)
- Bring your own API key (BYOK) support
- File uploads with RAG document search
- AI memory system (remembers context across conversations)
- Batch prospect research with report generation
- CRM integrations (Bloomerang, Virtuous, Neon CRM, DonorPerfect)
- Giving capacity calculator (TFG Research formulas)
- Knowledge profiles for organization-specific context
- Voice input via Groq Whisper
- GDPR-compliant data export and deletion
- Clean, responsive UI with light/dark themes
- Built with Tailwind CSS, shadcn/ui, and prompt-kit
- Self-hostable

## Quick Start

```bash
git clone https://github.com/ibelick/romy.git
cd romy
npm install
echo "OPENROUTER_API_KEY=your-key" > .env.local
npm run dev
```

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ibelick/romy)

To unlock features like auth, file uploads, see [DOCS.md](./docs/DOCS.md). For the full list of data sources, see [DATA_SOURCES.md](./docs/DATA_SOURCES.md).

## Built with

- [prompt-kit](https://prompt-kit.com/) — AI components
- [shadcn/ui](https://ui.shadcn.com) — core components
- [motion-primitives](https://motion-primitives.com) — animated components
- [vercel ai sdk](https://vercel.com/blog/introducing-the-vercel-ai-sdk) — model integration, AI features
- [supabase](https://supabase.com) — auth and storage

## Sponsors

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>

## License

Apache License 2.0

## Notes

This is a beta release. The codebase is evolving and may change.
