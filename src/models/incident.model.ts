// Filtre pour GET /incidents
export interface IncidentFilters {
  category?: string;
  timePeriod?: "jour" | "nuit" | "soir";
  pdqId?: number;
  limit?: number;
}

// Format pour le FrontEnd
export interface IncidentResponse {
  id: number;
  category: string;
  date: string;
  timePeriod: "jour" | "nuit" | "soir";

  // Géometrie
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