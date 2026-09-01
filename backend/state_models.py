from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ApplicationState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    units: list[dict[str, Any]] = Field(default_factory=list)
    categorias: list[dict[str, Any]] = Field(default_factory=list)
    centrosCusto: list[dict[str, Any]] = Field(default_factory=list)
    fornecedores: list[dict[str, Any]] = Field(default_factory=list)
    bancos: list[dict[str, Any]] = Field(default_factory=list)
    condicoesPagamento: list[dict[str, Any]] = Field(default_factory=list)
    users: list[dict[str, Any]] = Field(default_factory=list)
    lancamentos: list[dict[str, Any]] = Field(default_factory=list)
    parcelamentos: list[dict[str, Any]] = Field(default_factory=list)
    documentosOCR: list[dict[str, Any]] = Field(default_factory=list)
    auditLogs: list[dict[str, Any]] = Field(default_factory=list)
    regrasAutomacao: list[dict[str, Any]] = Field(default_factory=list)
    dreData: list[dict[str, Any]] = Field(default_factory=list)
    sessaoCaixa: dict[str, Any] = Field(default_factory=dict)
    fechamentoMensal: dict[str, Any] = Field(default_factory=dict)


class SaveStateRequest(BaseModel):
    expectedRevision: int = Field(ge=0)
    data: ApplicationState
