# CrimeVision - Project Context

## Vision

CrimeVision is an open data platform dedicated to the exploration, visualization, and understanding of criminal activity in Québec, beginning with Montréal and expanding province-wide.

Its purpose is **not** to replace official government sources, but to centralize, normalize, and present publicly available criminal data through a modern, intuitive interface.

CrimeVision acts as an intelligence layer on top of official datasets, allowing citizens, journalists, researchers, students, organizations, and government agencies to better understand crime trends.

---

# Mission

Create the most complete and accessible criminal intelligence platform for Québec by aggregating every publicly available official source related to crime, public safety, justice, and victimization.

The platform should provide:

- Interactive maps
- Historical trends
- Statistical dashboards
- Crime definitions
- Government reports
- Public datasets
- Educational resources
- Source transparency

Every displayed statistic must be traceable back to an official source.

---

# Core Principles

## Official Sources Only

CrimeVision only consumes publicly available official information.

Examples include:

- SPVM
- Sûreté du Québec
- Gouvernement du Québec
- Ville de Montréal Open Data
- Données Québec
- Statistics Canada
- Canadian Centre for Justice and Community Safety Statistics
- Ministère de la Justice
- MSSS
- INSPQ
- Canadian Anti-Fraud Centre

No unofficial statistics should ever be presented as factual.

---

## Source Transparency

Every dataset must include:

- organization
- publication
- retrieval date
- update frequency
- methodology
- license
- original URL

Users should always be able to navigate back to the original publication.

---

## Data Normalization

Government agencies publish data in different formats.

CrimeVision maintains its own internal data model while preserving original datasets.

```
Government Data
        ↓
Raw Import
        ↓
Validation
        ↓
Normalization
        ↓
CrimeVision Database
        ↓
API
        ↓
Frontend
```

No information should be lost during transformation.

---

# Long-Term Scope

CrimeVision aims to centralize **everything considered criminal or directly related to criminal activity** in Québec.

This includes:

## Crimes Against Persons

- Homicide
- Attempted murder
- Assault
- Aggravated assault
- Criminal negligence
- Kidnapping
- Harassment
- Human trafficking
- Intimidation
- Criminal threats

---

## Sexual Offences

- Sexual assault
- Sexual exploitation
- Child exploitation
- Luring
- Child pornography offences
- Voyeurism

---

## Crimes Against Property

- Theft
- Motor vehicle theft
- Burglary
- Robbery
- Mischief
- Arson
- Shoplifting
- Property damage

---

## Financial Crimes

- Fraud
- Identity theft
- Identity fraud
- Money laundering
- Counterfeiting
- Forgery
- Financial exploitation

---

## Cybercrime

- Online fraud
- Phishing
- Malware
- Ransomware
- Identity compromise
- Cyber harassment

---

## Weapons

- Firearms offences
- Illegal possession
- Weapons trafficking

---

## Drugs

- Drug possession
- Drug trafficking
- Production
- Importation

---

## Organized Crime

- Criminal organizations
- Street gangs
- Drug networks
- Smuggling

---

## Terrorism

Publicly available statistical information related to terrorism investigations and offences.

---

## Domestic Violence

- Intimate partner violence
- Family violence
- Child abuse
- Elder abuse

---

## Vulnerable Populations

Dedicated sections for:

- Children
- Teenagers
- Seniors
- Women
- Persons with disabilities
- Homeless populations

---

## Missing Persons

Publicly available information and statistics.

---

## Prevention

Educational material from official organizations.

---

## Justice

Where publicly available:

- Court statistics
- Sentencing trends
- Convictions
- Clearance rates

---

# Geographic Scope

The platform begins with Montréal.

Expansion order:

1. Montréal
2. Québec
3. Canada

Every entity should support:

- Province
- Administrative region
- Municipality
- Borough
- Police district
- Neighbourhood

---

# Platform Goals

CrimeVision should answer questions like:

- What crimes are increasing?
- Which neighbourhoods are improving?
- Which age groups are most affected?
- How has crime evolved over the last 20 years?
- Which crimes affect seniors?
- Which crimes affect children?
- Where are vehicle thefts concentrated?
- How do Montréal and Québec compare?
- What official reports exist for this crime?

---

# Technical Philosophy

CrimeVision is designed as a modular data platform.

Frontend and backend remain completely separated.

```
React Frontend
        ↓
REST API
        ↓
Node.js / Express
        ↓
Database
```

Future services may be added without changing the public API.

---

# Data Layers

CrimeVision stores three levels of data.

## 1. Raw

Original government datasets exactly as published.

Never modified.

---

## 2. Normalized

Internal CrimeVision representation.

All providers are converted into a common schema.

---

## 3. Presentation

Optimized datasets for:

- maps
- charts
- dashboards
- analytics
- search

---

# Main Domain Models

CrimeVision separates several concepts.

## Offense

Legal or statistical definition of a crime.

Examples:

- Homicide
- Robbery
- Fraud
- Assault

---

## Incident

A single criminal occurrence when available.

May include:

- date
- approximate location
- offence
- police service
- source

---

## Statistic

Aggregated numerical values.

Examples:

- yearly homicides
- monthly thefts
- assaults by borough

---

## Publication

Official reports.

Examples:

- annual reports
- government studies
- PDFs
- statistical summaries

---

## Source

Government organization publishing data.

Examples:

- SPVM
- Statistics Canada
- Gouvernement du Québec

---

## Location

Normalized geographic hierarchy.

Province

↓

Region

↓

Municipality

↓

Borough

↓

Neighbourhood

↓

Police District

---

# Design Philosophy

CrimeVision is not only a statistics website.

It is also:

- an educational platform
- a research platform
- a historical archive
- a public transparency project

---

# User Experience Goals

Users should be able to discover information naturally.

Example flow:

```
Crime
    ↓
Definition
    ↓
Statistics
    ↓
Historical Evolution
    ↓
Map
    ↓
Official Reports
    ↓
Related Crimes
    ↓
Prevention Resources
```

---

# Future Possibilities

- Live dashboards
- Automated dataset synchronization
- AI-assisted report summaries
- Comparative analytics
- Crime prediction research (clearly distinguished from official data)
- Custom dashboards
- Saved reports
- Public API
- Mobile application

---

# Success Criteria

CrimeVision succeeds when it becomes the single destination where someone can explore Québec's publicly available criminal information without having to search dozens of government websites, PDFs, spreadsheets, and statistical reports.

Rather than replacing official sources, CrimeVision makes them easier to discover, understand, compare, and visualize while preserving complete attribution and transparency.