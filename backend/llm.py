"""LLM provider abstraction — Anthropic, OpenAI, Google (BYOK).

The app is BYOK (bring your own key). Each /query request carries a
priority-ordered list of provider credentials. We try them in order and fall
back to the next one on auth / rate-limit / availability errors, so a user can
e.g. keep Claude as primary and GPT as backup.

The shared backend Anthropic key (free tier) is NOT applied here — callers that
want it must pass it explicitly via `providers`/`fallback_api_key`. Keeping it
out of this module ensures the shared key is only ever used through the metered
free-question path in main.py, never silently for other endpoints.

Provider SDKs are imported lazily inside each adapter so a deployment that only
uses one provider need not have the others installed.
"""

from typing import Optional


class LLMError(Exception):
    """Raised with a user-friendly message when all providers fail."""


MAX_TOKENS = 1024

# Sensible, cost-effective defaults per provider; a request may override `model`.
DEFAULT_MODELS = {
    "anthropic": "claude-haiku-4-5",
    "openai": "gpt-4o-mini",
    "google": "gemini-1.5-flash",
}


# ----- Provider adapters: (system_prompt, messages, api_key, model) -> str ----
# `messages` is a list of {"role": "user"|"assistant", "content": str}.
# Each adapter raises LLMError on a provider-specific failure so the caller can
# fall through to the next provider.


def _call_anthropic(system_prompt: str, messages: list, api_key: str, model: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            messages=messages,
        )
    except anthropic.AuthenticationError:
        raise LLMError("Anthropic key is invalid or expired.")
    except anthropic.RateLimitError:
        raise LLMError("Anthropic rate limit hit.")
    except anthropic.APIError as exc:
        raise LLMError(f"Anthropic error: {exc}")
    return "".join(b.text for b in resp.content if b.type == "text").strip()


def _call_openai(system_prompt: str, messages: list, api_key: str, model: str) -> str:
    from openai import OpenAI, AuthenticationError, RateLimitError, APIError

    client = OpenAI(api_key=api_key)
    full = [{"role": "system", "content": system_prompt}, *messages]
    try:
        resp = client.chat.completions.create(
            model=model, max_tokens=MAX_TOKENS, messages=full
        )
    except AuthenticationError:
        raise LLMError("OpenAI key is invalid or expired.")
    except RateLimitError:
        raise LLMError("OpenAI rate limit hit.")
    except APIError as exc:
        raise LLMError(f"OpenAI error: {exc}")
    return (resp.choices[0].message.content or "").strip()


def _call_google(system_prompt: str, messages: list, api_key: str, model: str) -> str:
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    gmodel = genai.GenerativeModel(model_name=model, system_instruction=system_prompt)
    # Google uses "model" for the assistant role; map our messages over.
    contents = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [m["content"]]}
        for m in messages
    ]
    try:
        resp = gmodel.generate_content(contents)
    except Exception as exc:  # SDK raises a variety of error types; normalize.
        msg = str(exc)
        if any(s in msg for s in ("API_KEY", "API key", "PERMISSION", "invalid")):
            raise LLMError("Google API key is invalid or lacks access.")
        raise LLMError(f"Google error: {exc}")
    return (getattr(resp, "text", "") or "").strip()


_ADAPTERS = {
    "anthropic": _call_anthropic,
    "openai": _call_openai,
    "google": _call_google,
}

SUPPORTED_PROVIDERS = tuple(_ADAPTERS.keys())


def answer(
    system_prompt: str,
    messages: list,
    providers: Optional[list] = None,
    fallback_api_key: Optional[str] = None,
) -> str:
    """Try each provider in priority order; return the first successful answer.

    `providers` is a priority-ordered list of dicts:
        {"provider": "anthropic"|"openai"|"google", "api_key": "...", "model"?: "..."}
    When empty, falls back to a single Anthropic key (`fallback_api_key`) to
    preserve the original single-key BYOK behaviour.
    """
    creds = [c for c in (providers or []) if c]

    if not creds and fallback_api_key:
        creds = [{"provider": "anthropic", "api_key": fallback_api_key}]

    if not creds:
        raise LLMError(
            "No API key provided. Add a provider key in Settings to ask questions."
        )

    errors: list[str] = []
    for cred in creds:
        provider = (cred.get("provider") or "").lower().strip()
        api_key = (cred.get("api_key") or "").strip()
        if not provider or not api_key:
            continue
        adapter = _ADAPTERS.get(provider)
        if adapter is None:
            errors.append(f"{provider}: unsupported provider")
            continue
        model = cred.get("model") or DEFAULT_MODELS.get(provider)
        try:
            return adapter(system_prompt, messages, api_key, model)
        except LLMError as exc:
            errors.append(str(exc))  # try the next provider in priority order
        except Exception as exc:  # never crash the request on an unexpected error
            errors.append(f"{provider}: {exc}")

    if errors:
        raise LLMError("All configured providers failed: " + " · ".join(errors))
    raise LLMError("No usable provider key was configured.")
