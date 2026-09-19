export interface IncidentFilters {
  category?: string;
  timePeriod?: "jour" | "nuit" | "soir";
  pdqId?: number;
  limit?: number;
}

export interface IncidentResponse {
  id: number;
  category: string;
  date: string;
  timePeriod: "jour" | "nuit" | "soir";

  x?: number | null;
  y?: number | null;
  longitude?: number | null;
  latitude?: number | null;

  pdq: {
    id: number;
    name: string;
    address: string;
  };
}
