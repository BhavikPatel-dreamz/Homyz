import type { ReactNode, SVGProps } from "react";

type AmenityIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  id: string;
};

const amenityKinds: Record<string, string> = {
  wifi: "wifi", tv: "tv", smart_tv: "tv", kitchen: "kitchen", washer: "washer", dryer: "dryer",
  free_parking: "parking", paid_parking: "parking", garage: "garage", street_parking: "parking", accessible_parking: "parking",
  self_check_in: "key", air_conditioning: "air_conditioner", heating: "heat", workspace: "desk", hot_water: "shower",
  iron: "iron", hair_dryer: "hair_dryer", essentials: "box", towels: "towels", bed_linens: "bed", hangers: "hanger", extra_pillows_blankets: "bed",
  refrigerator: "fridge", freezer: "snow", microwave: "microwave", oven: "oven", stove: "stove", dishwasher: "dish", coffee_maker: "coffee", kettle: "kettle", toaster: "toaster", cooking_basics: "pan", dishes_cutlery: "cutlery", dining_table: "table", blender: "blender", bbq_utensils: "grill",
  shower: "shower", bathtub: "bath", shampoo: "bottle", conditioner: "bottle", body_soap: "soap", toilet_paper: "paper", bidet: "bath",
  room_darkening_shades: "curtain", clothing_storage: "wardrobe", drying_rack: "rack",
  sound_system: "speaker", books: "books", board_games: "games", game_console: "console", pool_table: "pool_table",
  pool: "pool", private_pool: "pool", shared_pool: "pool", hot_tub: "bath", sauna: "sauna", gym: "gym", indoor_fireplace: "fireplace", piano: "piano", beach_access: "beach", lake_access: "water", waterfront: "water",
  patio: "patio", private_balcony: "balcony", shared_balcony: "balcony", backyard: "tree", garden: "flower", outdoor_furniture: "chair", outdoor_dining_area: "table", bbq_grill: "grill", fire_pit: "fireplace", hammock: "hammock",
  ev_charger: "charger", pet_friendly: "paw", elevator: "elevator",
  cleaning_available: "cleaning", luggage_dropoff: "luggage", long_term_stays_allowed: "calendar",
  smoke_alarm: "smoke", first_aid_kit: "first_aid", fire_extinguisher: "extinguisher", carbon_monoxide_alarm: "alarm", emergency_exit: "exit", security_system: "shield",
  step_free_entrance: "entrance", step_free_path: "path", wide_entrance: "entrance", wide_hallways: "path", step_free_bedroom: "bed", step_free_bathroom: "shower", grab_rails: "rails", roll_in_shower: "shower", shower_chair: "chair",
};

const amenityAssetSources: Record<string, string> = {
  wifi: "/images/icons/streamline-freehand/wifi-on--Streamline-Freehand.svg",
  shampoo: "/images/icons/streamline-freehand/shampoo.svg",
  air_conditioning: "/images/icons/streamline-freehand/air-conditioning.svg",
  body_soap: "/images/icons/streamline-freehand/body-soap.svg",
  blender: "/images/icons/streamline-freehand/blender.svg",
  beach_access: "/images/icons/streamline-freehand/beach-essentials.svg",
  first_aid_kit: "/images/icons/streamline-freehand/first-aid-kit.svg",
  smoke_alarm: "/images/icons/streamline-freehand/smoke-alarm.svg",
  dryer: "/images/icons/streamline-freehand/toilet-hand-dryer--Streamline-Freehand.svg",
  free_parking: "/images/icons/streamline-freehand/free-parking-on-premises.svg",
  hot_water: "/images/icons/streamline-freehand/hot-water.svg",
  iron: "/images/icons/streamline-freehand/iron.svg",
  hair_dryer: "/images/icons/streamline-freehand/hair-dryer.svg",
  bidet: "/images/icons/streamline-freehand/bidet.svg",
  bbq_grill: "/images/icons/streamline-freehand/bbq-grill.svg",
  kitchen: "/images/icons/kitchen.svg",
  self_check_in: "/images/icons/streamline-freehand/login-logout-key--Streamline-Freehand.svg",
  paid_parking: "/images/icons/streamline-freehand/credit-card-payment--Streamline-Freehand.svg",
  towels: "/images/icons/streamline-freehand/laundry-hand-wash--Streamline-Freehand.svg",
  bed_linens: "/images/icons/streamline-freehand/bed-linens.svg",
  hangers: "/images/icons/streamline-freehand/hanger.svg",
  clothing_storage: "/images/icons/streamline-freehand/locker-room-hanger-woman--Streamline-Freehand.svg",
  drying_rack: "/images/icons/streamline-freehand/laundry-hand-wash--Streamline-Freehand.svg",
  room_darkening_shades: "/images/icons/streamline-freehand/light-mode-night-architecture--Streamline-Freehand.svg",
  piano: "/images/icons/streamline-freehand/instrument-electronic-keyboard--Streamline-Freehand.svg",
  backyard: "/images/icons/streamline-freehand/backyard.svg",
  ev_charger: "/images/icons/streamline-freehand/power-supply-plug--Streamline-Freehand.svg",
  carbon_monoxide_alarm: "/images/icons/streamline-freehand/alerts-warning-triangle--Streamline-Freehand.svg",
  tv: "/images/icons/streamline-freehand/tv.svg",
  smart_tv: "/images/icons/streamline-freehand/wifi-monitor-1--Streamline-Freehand.svg",
  washer: "/images/icons/streamline-freehand/laundry-washing-machine--Streamline-Freehand.svg",
  workspace: "/images/icons/streamline-freehand/office-desk-1--Streamline-Freehand.svg",
  sound_system: "/images/icons/streamline-freehand/speaker--Streamline-Freehand.svg",
  books: "/images/icons/streamline-freehand/books-and-reading-material.svg",
  board_games: "/images/icons/streamline-freehand/board-games.svg",
  game_console: "/images/icons/streamline-freehand/video-game-controller--Streamline-Freehand.svg",
  pool: "/images/icons/streamline-freehand/swimming-pool-person--Streamline-Freehand.svg",
  private_pool: "/images/icons/streamline-freehand/swimming-pool-person--Streamline-Freehand.svg",
  shared_pool: "/images/icons/streamline-freehand/swimming-pool-person--Streamline-Freehand.svg",
  elevator: "/images/icons/streamline-freehand/lift-two-people-elevator--Streamline-Freehand.svg",
  pet_friendly: "/images/icons/streamline-freehand/work-from-home-user-pet-cat--Streamline-Freehand.svg",
  cleaning_available: "/images/icons/streamline-freehand/cleaning-robot-vacuum--Streamline-Freehand.svg",
  luggage_dropoff: "/images/icons/streamline-freehand/moving-walkway-luggage-1--Streamline-Freehand.svg",
  long_term_stays_allowed: "/images/icons/streamline-freehand/calendar-date--Streamline-Freehand.svg",
  fire_extinguisher: "/images/icons/streamline-freehand/fire-extinguisher.svg",
  emergency_exit: "/images/icons/streamline-freehand/safety-exit-door--Streamline-Freehand.svg",
  security_system: "/images/icons/streamline-freehand/security-computer-shield--Streamline-Freehand.svg",
  step_free_entrance: "/images/icons/streamline-freehand/disability-wheelchair-way--Streamline-Freehand.svg",
  step_free_path: "/images/icons/streamline-freehand/disability-wheelchair-way--Streamline-Freehand.svg",
  accessible_parking: "/images/icons/streamline-freehand/disability-wheelchair-3--Streamline-Freehand.svg",
};

export function AmenityIcon({ id, className, ...props }: AmenityIconProps) {
  const kind = amenityKinds[id] ?? "box";
  const assetSource = amenityAssetSources[id] ?? null;
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1 };
  const shapes: Record<string, ReactNode> = {
    wifi: <><path {...common} d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.5a8 8 0 0 1 11 0M9.5 15.5a4 4 0 0 1 5 0" /><path {...common} d="M12 19h.01" strokeWidth="3" /></>,
    tv: <><rect {...common} x="3" y="5" width="18" height="13" rx="2" /><path {...common} d="m8 21 2-3m4 0 2 3M9 3l3 2 3-2" /></>,
    kitchen: <><rect {...common} x="4" y="5" width="16" height="14" rx="2" strokeWidth="1.35" /><path {...common} d="M4 10h16M8 7h.01m4 0h.01m4 0h.01M8 14h8" strokeWidth="1.35" /></>,
    washer: <><rect {...common} x="4" y="3" width="16" height="18" rx="2" /><circle {...common} cx="12" cy="14" r="4" /><path {...common} d="M7 7h.01M10 7h4" /></>,
    dryer: <><circle {...common} cx="12" cy="12" r="8" /><path {...common} d="M9 8c2 1 4 0 6 2s0 4-2 5m-5 1c2-1 4 0 5 2" /></>, hair_dryer: <><path {...common} d="M5 10h8a4 4 0 1 1 0 8H9l-3 3v-6a5 5 0 0 1-1-5Z" /><path {...common} d="M8 10V7h7M15 13h3" /></>, air_conditioner: <><rect {...common} x="3" y="5" width="18" height="8" rx="3" /><path {...common} d="M7 9h10M7 13c0 3 2 3 2 5m3-5c0 3 2 3 2 5m3-5c0 2 1 3 1 4" /></>,
    parking: <><rect {...common} x="4" y="3" width="16" height="18" rx="2" /><path {...common} d="M9 17V7h4a3 3 0 0 1 0 6H9" /></>,
    garage: <><path {...common} d="m3 10 9-7 9 7v10H3zM7 20v-7h10v7M7 16h10" /></>, key: <><circle {...common} cx="8" cy="9" r="4" /><path {...common} d="m11 12 8 8m-3-3 2-2m-5 2 2-2" /></>,
    snow: <><path {...common} d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 3 4-3M8 20l4-3 4 3" /></>, heat: <><path {...common} d="M12 21c4-3 5-6 3-9-1 2-2 2-3 3 1-4-1-6-4-8 0 4-3 6-3 10 0 3 3 4 7 4Z" /></>,
    desk: <><path {...common} d="M4 9h16v7H4zM7 16v5m10-5v5M8 6h8" /></>, shower: <><path {...common} d="M5 20V9a7 7 0 0 1 14 0H9" /><path {...common} d="M11 13v.01m3 2v.01m3-2v.01m-6 5v.01m3-1v.01" strokeWidth="2.5" /></>,
    iron: <><path {...common} d="M4 16h16l-3-7H9L4 16Zm0 0v3h16" /><path {...common} d="M9 9V6h5" /></>, box: <><path {...common} d="m4 8 8-4 8 4v10l-8 4-8-4zM4 8l8 4 8-4m-8 4v10" /></>, towels: <><path {...common} d="M5 4h10v15H5zM9 4h10v16H9M8 8h4" /></>, bed: <><path {...common} d="M3 17V8h5a3 3 0 0 1 3 3v6m0-4h10v4M5 17v3m14-3v3" /></>, hanger: <><path {...common} d="M9 7a3 3 0 1 1 5 0c0 2 1 3 3 4l4 4H3l4-4c2-1 2-2 2-4Z" /></>,
    fridge: <><rect {...common} x="6" y="3" width="12" height="18" rx="2" /><path {...common} d="M6 11h12M9 7v1m0 7v2" /></>, microwave: <><rect {...common} x="3" y="6" width="18" height="12" rx="2" /><path {...common} d="M7 10h6m-6 3h4m6-3h.01m0 4h.01" strokeWidth="2" /></>, oven: <><rect {...common} x="5" y="3" width="14" height="18" rx="2" /><path {...common} d="M5 9h14m-9 5h4m-7-8h.01m3 0h.01m3 0h.01" /><rect {...common} x="8" y="12" width="8" height="6" rx="1" /></>, stove: <><rect {...common} x="4" y="4" width="16" height="16" rx="2" /><circle {...common} cx="8" cy="9" r="2" /><circle {...common} cx="16" cy="9" r="2" /><circle {...common} cx="8" cy="16" r="2" /><circle {...common} cx="16" cy="16" r="2" /></>,
    dish: <><path {...common} d="M4 5h16v14H4zM7 9h10m-8 4h6m-7 4h8" /></>, coffee: <><path {...common} d="M6 8h10v11H6zM16 10h2a2 2 0 0 1 0 4h-2M8 5h6M9 19h5" /></>, kettle: <><path {...common} d="M7 10a5 5 0 0 1 10 0v7H7zM10 6h4m3 6h2m-12 5H5" /></>, toaster: <><path {...common} d="M5 9h14v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM8 9V6h8v3m-8 5h.01" /></>, pan: <><circle {...common} cx="10" cy="12" r="5" /><path {...common} d="M14 12h7M7 5l1-2m4 2 1-2" /></>, cutlery: <><path {...common} d="M6 3v8m-3-8v5a3 3 0 0 0 6 0V3m-3 8v10m10-18v18m0-18c3 3 3 7 0 9" /></>, table: <><path {...common} d="M4 8h16v5H4zM7 13v8m10-8v8M2 21h20" /></>, blender: <><path {...common} d="M9 3h6l-1 8h-4zM8 11h8v7H8zM6 21h12M11 15h2" /></>, grill: <><path {...common} d="M5 10h14l-2 6H7zM8 16l-2 5m10-5 2 5M4 7h16M9 4v3m6-3v3" /></>,
    bath: <><path {...common} d="M4 12h16v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V8a2 2 0 0 1 4 0v1" /><path {...common} d="M3 20h18" /></>, bottle: <><path {...common} d="M9 3h6v4l2 3v10H7V10l2-3zM9 12h6" /></>, soap: <><rect {...common} x="7" y="9" width="10" height="11" rx="2" /><path {...common} d="M10 9V6h5m-2-2v2m-3 7h4m4-5h-5" /><circle {...common} cx="18" cy="6" r="1" /></>, paper: <><circle {...common} cx="11" cy="12" r="7" /><circle {...common} cx="11" cy="12" r="2" /><path {...common} d="M18 8h3v9h-3" /></>,
    curtain: <><path {...common} d="M4 4h16M6 4v16m12-16v16M6 7c2 2 4 2 6 0 2 2 4 2 6 0" /></>, wardrobe: <><rect {...common} x="5" y="3" width="14" height="18" rx="1" /><path {...common} d="M12 3v18M10 12h.01m4 0h.01" /></>, rack: <><path {...common} d="M5 5h14M7 5l-3 14m13-14 3 14M6 12h12M3 20h18" /></>, speaker: <><path {...common} d="M5 10h4l5-4v12l-5-4H5zM17 9a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12" /></>,
    books: <><path {...common} d="M4 4h5v16H4zM9 4h5v16H9zM14 6h5v14h-5z" /></>, games: <><rect {...common} x="4" y="4" width="16" height="16" rx="2" /><circle {...common} cx="9" cy="9" r="1" /><circle {...common} cx="15" cy="15" r="1" /><circle {...common} cx="15" cy="9" r="1" /><circle {...common} cx="9" cy="15" r="1" /></>, console: <><path {...common} d="M5 16 3 13a4 4 0 0 1 6-5l3 2 3-2a4 4 0 0 1 6 5l-2 3a2 2 0 0 1-3 0l-2-2h-4l-2 2a2 2 0 0 1-3 0Z" /><path {...common} d="M7 11v4m-2-2h4m10-1h.01" /></>, pool_table: <><path {...common} d="M4 7h16l-2 9H6zM8 16l-1 5m9-5 1 5" /><circle {...common} cx="12" cy="11" r="2" /></>,
    pool: <><path {...common} d="M3 8h18v5H3zM3 17c2-2 4 2 6 0s4 2 6 0 4 2 6 0" /><path {...common} d="M6 8V5m12 3V5" /></>, sauna: <><path {...common} d="M5 21V9h14v12M8 6c0-2 2-2 2-4m4 4c0-2 2-2 2-4M9 14h6m-8 7v-5m10 5v-5" /></>, gym: <><path {...common} d="M3 10v4m3-7v10m2-5h8m0-5v10m3-7v4" /></>, fireplace: <><path {...common} d="M5 21V8h14v13M9 21v-5a3 3 0 0 1 6 0v5M12 18c2-2 2-4 0-6-2 2-2 4 0 6Z" /></>, piano: <><path {...common} d="M5 4h14v13H5zM8 4v9m3-9v9m3-9v9m3-9v9M4 20h16" /></>, beach: <><path {...common} d="M4 16h16M12 16V8m0 0c3 0 4 2 5 3-3 1-5 0-5-3ZM4 20c2-2 4 2 6 0s4 2 6 0 4 2 4 0" /></>, water: <><path {...common} d="M3 9c2-2 4 2 6 0s4-2 6 0 4-2 6 0M3 14c2-2 4 2 6 0s4-2 6 0 4-2 6 0M3 19c2-2 4 2 6 0s4-2 6 0 4-2 6 0" /></>,
    patio: <><path {...common} d="M4 20h16M6 20v-7h12v7M9 13V7h6v6M5 7h14" /></>, balcony: <><path {...common} d="M4 4h16v5H4zM6 9v11m4-11v11m4-11v11m4-11v11M3 20h18" /></>, tree: <><path {...common} d="M12 21v-6m0 0-6-4 4-2-2-4 4-3 4 3-2 4 4 2-6 4ZM6 21h12" /></>, flower: <><circle {...common} cx="12" cy="9" r="2" /><path {...common} d="M12 7c-4-5-7 2-2 3-5 1-2 8 2 3 4 5 7-2 2-3 5-1 2-8-2-3ZM12 13v8" /></>, chair: <><path {...common} d="M6 12V6a3 3 0 0 1 6 0v6m0 0h6v5H6v-5Zm-1 5-1 4m13-4 1 4" /></>, hammock: <><path {...common} d="M4 20c5 0 5-8 8-8s3 8 8 8M4 20V5m16 15V5" /></>,
    charger: <><path {...common} d="M9 3h6v7h2v4h-2v7H9v-7H7v-4h2zM12 6v6m-2-2 2 2 2-2" /></>, paw: <><circle {...common} cx="12" cy="15" r="4" /><circle {...common} cx="6" cy="9" r="1.5" /><circle {...common} cx="11" cy="6" r="1.5" /><circle {...common} cx="16" cy="7" r="1.5" /><circle {...common} cx="19" cy="11" r="1.5" /></>, elevator: <><rect {...common} x="5" y="3" width="14" height="18" rx="1" /><path {...common} d="m9 8 3-3 3 3M9 16l3 3 3-3M12 5v14" /></>,
    cleaning: <><path {...common} d="m7 3 5 5m-3-3L5 9l7 7 4-4-7-7Zm3 11 4 5m-1-7 3 3" /></>, luggage: <><rect {...common} x="6" y="6" width="12" height="15" rx="2" /><path {...common} d="M9 6V4h6v2m-6 5h6m-5 10v-3m4 3v-3" /></>, calendar: <><rect {...common} x="4" y="5" width="16" height="15" rx="2" /><path {...common} d="M8 3v4m8-4v4M4 10h16m-11 4h6m-6 3h4" /></>,
    alarm: <><circle {...common} cx="12" cy="13" r="6" /><path {...common} d="M12 10v4m0 3h.01M6 5 4 3m14 2 2-2" /></>, smoke: <><circle {...common} cx="12" cy="11" r="6" /><path {...common} d="M8 11h8M9 14h6M7 20c1-2 2-2 3 0s2 2 3 0 2-2 4 0" /></>, first_aid: <><rect {...common} x="3" y="6" width="18" height="13" rx="2" /><path {...common} d="M10 4h4v2m-4 7h4m-2-2v4" /></>, extinguisher: <><path {...common} d="M8 21V9h8v12M9 9V5h5v4m2 3h3V8h-3M8 21h8" /><path {...common} d="M11 13h2" /></>, exit: <><path {...common} d="M4 3h12v18H4zM10 12h10m-3-3 3 3-3 3" /><circle {...common} cx="9" cy="12" r="1" /></>, shield: <><path {...common} d="M12 3 20 6v5c0 5-3 8-8 10-5-2-8-5-8-10V6zM9 12l2 2 4-4" /></>,
    entrance: <><path {...common} d="M5 21V4h11v17M9 21v-7h4v7M3 21h18" /><path {...common} d="M18 8h3m-1.5-1.5V9.5" /></>, path: <><path {...common} d="M4 4h16M4 20h16M8 4v16m8-16v16" /><path {...common} d="m10 10 2 2 2-2" /></>, rails: <><path {...common} d="M6 21V6a3 3 0 0 1 6 0v3H9m9 12V9a3 3 0 0 0-3-3h-3M6 15h12" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} {...props}>{assetSource ? <image href={assetSource} width="24" height="24" preserveAspectRatio="xMidYMid meet" /> : shapes[kind]}</svg>;
}
