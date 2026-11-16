import {normalizeFilters} from './shop-state.mjs';

export const CATALOG_FILTER_DEFAULTS=Object.freeze({category:'all',duration:'all',sort:'recommended'});
const groups=Object.keys(CATALOG_FILTER_DEFAULTS);

export function activeCatalogFilterCount(value){
  const normalized=normalizeFilters(value);
  return groups.filter(key=>normalized[key]!==CATALOG_FILTER_DEFAULTS[key]).length;
}

// Draft choices stay separate from the applied catalogue until the sheet is confirmed.
export function createCatalogFilterDraft(readApplied){
  let draft=null;
  const snapshot=()=>draft?{...draft}:null;
  return {
    open(){draft=normalizeFilters(readApplied());return snapshot();},
    snapshot,
    set(key,value){
      if(draft&&groups.includes(key))draft=normalizeFilters({...draft,[key]:value});
      return snapshot();
    },
    clear(){
      if(draft)draft=normalizeFilters({...draft,...CATALOG_FILTER_DEFAULTS});
      return snapshot();
    },
    apply(){
      if(!draft)return null;
      const next=normalizeFilters({...readApplied(),...Object.fromEntries(groups.map(key=>[key,draft[key]]))});
      draft=null;
      return next;
    },
    cancel(){draft=null;}
  };
}
