# anymodel

### One chat. 150+ AI providers. Thousands of models. Your keys. Your browser.

**Live → https://abduljawad-ai.github.io/anymodel/**

anymodel is a fast, privacy-first **BYOK (Bring Your Own API Key)** AI chat interface built to put a huge range of AI models in one place.

Connect your own API keys, choose a provider, pick a model, and start chatting.

No account.
No backend.
No platform lock-in.
No middleman holding your keys.

Everything runs directly in your browser.

---

## ✦ Why anymodel?

AI has become fragmented.

One model lives in one app.
Another lives somewhere else.
Different providers have different interfaces, limits, and tools.

**anymodel puts them behind one interface.**

Use the models you already have access to, switch providers whenever you want, and keep your conversations in one place.

> **You bring the keys. anymodel brings the interface.**

---

## ✨ What it can do

<table>
<tr>
<td width="50%">

### 🌐 150+ Providers

Connect a growing ecosystem of AI providers through a single interface.

From major hosted APIs to local and OpenAI-compatible endpoints.

</td>
<td width="50%">

### 🧠 Huge Model Catalog

Explore a large catalog of models and choose the right one for the task instead of being locked into a single provider.

</td>
</tr>

<tr>
<td>

### 🔑 Bring Your Own Key

Your API keys stay in your browser and are sent directly to the provider you choose.

No central server receives them.

</td>
<td>

### ⚡ Streaming Chat

Responses arrive as they are generated, with markdown rendering and syntax-highlighted code.

</td>
</tr>

<tr>
<td>

### 👁️ Vision & Attachments

Send images and audio, attach files, and use voice input directly from the composer.

</td>
<td>

### 🛠️ Tools & Web Access

Models can use supported tools for tasks that need current information or external actions.

</td>
</tr>

<tr>
<td>

### 💬 Persistent Conversations

Create, rename, switch, and delete conversations. Your sessions remain available after reloads.

</td>
<td>

### 📱 Built for Every Screen

A responsive interface designed to work smoothly across desktop, tablet, and mobile.

</td>
</tr>
</table>

---

## 🚀 Quick start

There is no build process and no dependency installation.

Clone the repository:

```bash
git clone https://github.com/abduljawad-ai/anymodel.git
cd anymodel
```

Start a local server:

```bash
python3 -m http.server 8899
```

Then open:

**http://localhost:8899/**

Open **Settings**, add your API key, choose a provider and model, and start chatting.

---

## 🔐 Privacy & security

anymodel follows a simple model:

**Your key → your browser → your chosen provider**

There is no application backend sitting between you and the provider.

API keys are stored locally in your browser and are sent only to the API endpoint you choose.

Keys are not hardcoded into the project and are not uploaded to an anymodel server.

> **Your credentials belong to you.**

### Important

BYOK does not magically make an API key risk-free.

If you use a browser application with your own API key, your browser is part of the security boundary. Only use providers and endpoints you trust.

---

## 🧩 Supported providers

anymodel is designed around a provider-agnostic architecture.

Examples include:

* Groq
* OpenAI
* Anthropic
* Google Gemini
* Ollama
* OpenAI-compatible APIs
* Custom endpoints

The provider catalog is designed to grow without requiring the chat interface itself to be rewritten.

---

## 🧠 Built around models, not brands

Instead of designing the application around a single AI provider, anymodel treats providers and models as data.

That means the same interface can support:

```text
Provider
   ↓
Models
   ↓
Capabilities
   ↓
Chat
```

Models can advertise capabilities such as:

* Text
* Vision
* Audio
* Tools
* Reasoning
* Streaming

So choosing a model becomes about **what it can do**, not just who made it.

---

## 🏗️ Architecture

anymodel is intentionally lightweight.

There is no large application server behind the interface.

```text
Browser
│
├── UI
├── Chat state
├── Provider catalog
├── Local persistence
│
└── Provider API
       ├── OpenAI
       ├── Anthropic
       ├── Gemini
       ├── Groq
       ├── Ollama
       └── OpenAI-compatible endpoints
```

### Project structure

```text
anymodel/
│
├── index.html
├── css/
│
├── js/
│   ├── api.js
│   ├── app.js
│   ├── catalog.js
│   ├── config.js
│   ├── state.js
│   └── components/
│
├── assets/
├── models-catalog.json
└── README.md
```

The frontend is built with plain **HTML, CSS, and JavaScript** with no framework requirement.

---

## 🎯 The idea

There are plenty of AI chat interfaces.

Most of them want you to use **their** models.

anymodel takes the opposite approach:

### Use the models you want.

Your provider.
Your API key.
Your choice of model.
One interface.

---

## 🛣️ What's next?

anymodel is still evolving.

The goal isn't simply to keep adding providers.

The goal is to make switching between hundreds of models feel **simple, fast, and natural**.

Better model discovery.
Better provider integrations.
Better tools.
Better conversations.
Better performance.

---

## 📜 License

All rights reserved.

The repository is publicly available for inspection and reference. No license is granted for reuse, redistribution, or derivative works unless explicitly stated otherwise.

---

<p align="center">
  Built for people who want <b>one interface for many models</b>.
</p>

<p align="center">
  <a href="https://abduljawad-ai.github.io/anymodel/">Live Demo</a>
  ·
  <a href="https://github.com/abduljawad-ai/anymodel">Repository</a>
</p>

