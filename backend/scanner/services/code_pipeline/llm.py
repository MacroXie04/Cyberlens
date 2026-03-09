from functools import cached_property

from google.adk import Agent
from google.adk.models.google_llm import Gemini
from google.genai import Client, types

from .schemas import CANDIDATE_GENERATION_INSTRUCTION, CHUNK_SUMMARY_INSTRUCTION, REPO_SYNTHESIS_INSTRUCTION, VERIFICATION_INSTRUCTION, CandidateBatch, ChunkSummary, RepoSynthesisReport, VerificationDecision


class ScopedGemini(Gemini):
    api_key: str

    @cached_property
    def api_client(self) -> Client:
        return Client(api_key=self.api_key, http_options=types.HttpOptions(headers=self._tracking_headers(), retry_options=self.retry_options, base_url=self.base_url))

    @cached_property
    def _live_api_client(self) -> Client:
        return Client(api_key=self.api_key, http_options=types.HttpOptions(headers=self._tracking_headers(), api_version=self._live_api_version))


def resolve_model_name(user_id: int | None, profile) -> str:
    from cyberlens.utils import get_user_gemini_model

    return profile.model_name_override or get_user_gemini_model(user_id)


def build_llm_model(model_name: str, api_key: str) -> ScopedGemini:
    return ScopedGemini(model=model_name, api_key=api_key)


def build_chunk_summary_agent(model: Gemini) -> Agent:
    return Agent(name="code_chunk_summarizer", model=model, instruction=CHUNK_SUMMARY_INSTRUCTION, output_schema=ChunkSummary, generate_content_config=types.GenerateContentConfig(temperature=0.2))


def build_candidate_agent(model: Gemini) -> Agent:
    return Agent(name="code_candidate_generator", model=model, instruction=CANDIDATE_GENERATION_INSTRUCTION, output_schema=CandidateBatch, generate_content_config=types.GenerateContentConfig(temperature=0.2))


def build_verifier_agent(model: Gemini) -> Agent:
    return Agent(name="code_security_verifier", model=model, instruction=VERIFICATION_INSTRUCTION, output_schema=VerificationDecision, generate_content_config=types.GenerateContentConfig(temperature=0.1))


def build_repo_synthesis_agent(model: Gemini) -> Agent:
    return Agent(name="code_repo_synthesizer", model=model, instruction=REPO_SYNTHESIS_INSTRUCTION, output_schema=RepoSynthesisReport, generate_content_config=types.GenerateContentConfig(temperature=0.2))
