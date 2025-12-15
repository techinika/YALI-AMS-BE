export interface ResidentDistrict {
  id: string;
  name: string;
}

export interface Country {
  id: string;
  name: string;
}

export interface State {
  id: string;
  name: string;
  countryCode: string;
}

export interface ResidentSector {
  id: string;
  name: string;
}

export interface WorkingSector {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  country: Country;
  state: State;
  district: ResidentDistrict;
  sector: ResidentSector;
  districtId: string;
  countryId: number;
  sectorId: string;
  stateId: string;
  website: string;
}
