from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class CustoPontoEquilibrio(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    descricao: str = Field(min_length=1, max_length=120)
    tipo: Literal["FIXO", "VARIAVEL_VALOR", "VARIAVEL_PERCENTUAL"]
    # Monetary values use cents. Rates use units of 0.01 percentage point.
    valor: int = Field(ge=0, le=99_999_999_999, strict=True)

    @model_validator(mode="after")
    def check_rate(self):
        if self.tipo == "VARIAVEL_PERCENTUAL" and self.valor > 10_000:
            raise ValueError("Cada percentual deve estar entre 0 e 100%.")
        return self


class PontoEquilibrioMensal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    unidadeId: str = Field(min_length=1, max_length=100)
    competencia: str = Field(pattern=r"^[1-9][0-9]{3}-(0[1-9]|1[0-2])$")
    receitaReferenciaCentavos: int | None = Field(default=None, ge=0, le=99_999_999_999, strict=True)
    custos: list[CustoPontoEquilibrio] = Field(max_length=200)

    @model_validator(mode="after")
    def check_id(self):
        if self.unidadeId == "all" or self.id != f"{self.unidadeId}:{self.competencia}":
            raise ValueError("Identificador inválido para a filial e a competência.")
        return self


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
    dreVersions: list[dict[str, Any]] = Field(default_factory=list)
    pontosEquilibrio: list[PontoEquilibrioMensal] = Field(default_factory=list)
    fechamentosMensais: list[dict[str, Any]] = Field(default_factory=list)
    sessaoCaixa: dict[str, Any] = Field(default_factory=dict)
    fechamentoMensal: dict[str, Any] = Field(default_factory=dict)


class SaveStateRequest(BaseModel):
    expectedRevision: int = Field(ge=0)
    data: ApplicationState
