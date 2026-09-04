"use client";

import React, { useState } from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { HeroSection } from "./hero-section";
import { CategoryCarousel } from "./category-carousel";
import { Footer } from "@/components/dashboard/footer";
import { PropertyCardData } from "./property-card";

export function HomeView() {
  const [searchFilter, setSearchFilter] = useState("");

  // Section 1: Popular home in Paris
  const parisCards: PropertyCardData[] = [
    {
      id: "paris-1",
      name: "Le Marais Chic Apartment",
      subtitle: "Sep 15–20 · Individual host",
      price: "$240 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuA6ahZ81SmFuekLgipigiG92Y63TcrOJP6N1y0yE2eD0vW9z-N_SVNmkhbjLn3_YDChUL2bt0bSYSJ1P3qWG-1LVGjyvi_6Z1qxzuZ2IXWYO7LMLEX4ThNk-23XvLxw8sVfK6uMWm-NT-Y4m1f55xw0kkkYGXb9Ecpo-1PIV8DQaTHd3kGD8WjNVmh4wHesuaZE0SLTO4RqGE2pUeM5BZXE91y52AOWHlC_p_fZb6b7xk0Y8Iu08QU0cQ",
    },
    {
      id: "paris-2",
      name: "Eiffel Tower View Loft",
      subtitle: "Oct 1–6 · Professional host",
      price: "$310 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAJcyTjA7RGUpi0J8jeuWyvT0PreTPjGXb91CivX3d5AwAda0nRsdcpStVDDKUNMQV4AJioYnyEOkPfCjaJWiXztZpgohxjGxfLW_bwDjRKhH0QremhumLOfIoIhumGyihyZNSZwMTGW-ka-mkyLHK_9OSimsSThpThFhgGjv4QpIZBCEYbhuRQ1_vdH2J4mVa149APH11QIpF81ftp7d0cj-5iSHnG5Fiuu95P7W9NW32ZSEy-5eYpDQ",
    },
    {
      id: "paris-3",
      name: "Montmartre Artist Studio",
      subtitle: "Sep 18–23 · Superhost",
      price: "$195 for 5 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuArOd7xfERxklqd7OiiFXGQucL6n-Kn8F7FRJ6vsU7o14CpYR3pzySDplDyJZuHSoeM3jIE9tsgnP5KgSvI0Z6oywN-zphDbA-CJfK0yv7BKHdsiL6hAUl9sTkXrQN1WhVmtffUrcRVrDkNtX1UGg20bfZbO2wlHS4zCiAq4bFC4TxwTHgqGApX97n8Xh2uOQyv900CQffeCbcy6vs6QlNs6pB-ugSvcjdpUeByMy0GVyiL-3vA3gnsPg",
    },
    {
      id: "paris-4",
      name: "Saint-Germain Cozy Haven",
      subtitle: "Oct 5–10 · Superhost",
      price: "$280 for 5 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAikBEIhpsQFIN8sjuWndmOXlSS54SXujr-NeZtLHa5uZNdQG1ZgxNtwIsUFnDPEEuIT8l7kPUH8W3Euzhl4twDU9autCS8alFWB_CZpER689iLKFw1EncgpbtN6QvfS5KGXhjtx_VzY8eRItNW0941sudEPS3ThPp4nfZWibv1Y3DQic4Z8FxaiCr07Ekm-JYfMZF3S23hs8JIYQ92if4d3z6LW4olx0n7vA0w3IQLoC9e81GflJz76w",
    },
    {
      id: "paris-5",
      name: "Canal Saint-Martin Suite",
      subtitle: "Sep 22–27 · Individual host",
      price: "$210 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuARAuqsqscEaYtHk0TR-CPL9L7D3dWy8zBTIcdRGfKdXEPQ483XMxYNlKdPCqvbmi6TFakwPWpKFpuBI0Igvujs6kBKzMXdRmjDLJ_N-xtMYpiaVQGd4L9UsLmc6CJ6GwdZU8n7FR9k1Jyobj6MncgLXAyW6LjwysjLB3ZgoSvSPZn2gF5eTyZsRA6b7xEtNL_e54aXQQay95JDfswpZd2kMjRBubjAJD4XEezefbwVqm8N2vXVzWAZow",
    },
    {
      id: "paris-6",
      name: "Opera Haussmann Flat",
      subtitle: "Oct 12–17 · Individual host",
      price: "$265 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBhmdG9-v9nKcGxxTKz2RQCRRFYbyhiLBSyIHNxfuh1CsfBUImkQ01DAw7iyp41ceRXqKzL0SD4uEvWaaw9IlRXHnLmID8OKBVM9ULkuo927b52gOpNoibGUvKd0zA13kXlupUa4v5DxTtrRBwuUAp5bRcporBJ2W8ob_wVlnpX8ZQFOCwBYvdp84zFp8oAih8sehWnMs1IbvJZohg9LofB28XEF37TjLv8iixag-tpfSYj7npdYNFvHw",
    },
  ];

  // Section 2: Stay in Hamburg
  const hamburgCards: PropertyCardData[] = [
    {
      id: "hamburg-1",
      name: "HafenCity Modern Loft",
      subtitle: "Sep 10–14 · Individual host",
      price: "$185 for 4 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAtz9UP9lmba-kMRj2nnSZCpqx6CMZsYvOVXdZP9l763GVh2Lv78EpD-pPpExCvApq_iEkdsJnaUSE77loBJbMXzBxLTmGP0828J5pOrWQCHunntH_nh99dantTZLqsXz_NH2212h3fQsC5oYeUxCnWp84_yiJ_qg4GK6W0qDfwecvBbvJFVwEWa0T-A2dbfZhJ0O0Nz6cu3hboH9Y5Q3k4WQh9QB7DZ97WYKDZK2bmm0mpu9bG9CWZ1g",
    },
    {
      id: "hamburg-2",
      name: "Speicherstadt Canal Suite",
      subtitle: "Sep 20–24 · Superhost",
      price: "$220 for 4 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBuBmPuBnHG-ielEg-wpYmgnUSWawkJf_SUFfPzvFjuS-vqN2epkZ3WSgY0rVHCQWJkXnHNBD-s8uul7w-tg6RB1ZLMs_h_X0hpaJXaXeCkwUsGTG6VucKUMdBRH2HM-rYQURZf67ztofiSsV2SoeXS2ETGHkmPzYmGmAQG6v-pMN9BC-HUmE3mYzmO4DyfgU_XaTa2YpTTyC_YPDQwyqm4NXDBbkgWI_fdFXZUm_4w3lfx_ZPe09cmbg",
    },
    {
      id: "hamburg-3",
      name: "St. Pauli Stylish Retreat",
      subtitle: "Oct 2–6 · Superhost",
      price: "$160 for 4 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDYofeAp7NCtDmMGZPbtRMJ6pWRBvgYYqecT_sgoNMdK5ZNwSR92Ue0_VPQRv_uZumf53itK1PgWsS9DF6BJRF5_NAR-pbose6wWv-qmBs0YUldYY-A_Sq_zy-v65j4__37MTKpwUMYZx2NwhMXhq2H05A2PHR99bMkuQYVcC2WBxlZk0pOw7XCJFv_cXbP3tUiQNf4F-aUevpqEqLJgJxWMYNj3FOXl86wgWEzH1HUXj9SxjhV0FD8fw",
    },
    {
      id: "hamburg-4",
      name: "Alster Lakeview Residence",
      subtitle: "Oct 10–14 · Superhost",
      price: "$290 for 4 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDHhlka6w2tJJbDMkni5J6e4q9jOGEY3yR1ePIthUeXx_Fa7IJfx--aC_aI16X0hekjlLSw7yZ1CTlj-xt4PCuGHe8i50JX_Yjuy3YeGTM8yAtnAWFe2lU-McVvt3fdGj4MTNUvVDeHK82NmxzQFZaAJcn1VO_JhsU7vo3d0mHnCH_SU2vj-GAdXlf1vipfFbA1Xz4YkR4Yktm1S8qzpAtHKinZsxH-iCpV_YPB6olaQdvZGksa457FMg",
    },
    {
      id: "hamburg-5",
      name: "Sternschanze Boho Penthouse",
      subtitle: "Sep 16–20 · Individual host",
      price: "$175 for 4 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCiBqj4enWnOJAqwnSMr8CBxWwj8QXAuHFU0-JtTbiXYp3dC7EHrkLggMZMvlneMpuM1QsWXdLJr0ewUvGfak-et3Zg0QOamOkfqXwXazBGV9kiPv7MXvvC8cT-Q98iktcEVNhG632TsyjbWVCLaVB7mgyCYYyCktA_m7dSytSg1Ld91GcKRVXvq0s9OYmDdqknS1fQpQ_an2n6X9HNrfEpOcMZLTptHByjdLCR3gyeA8Zj7mowbAwPzA",
    },
    {
      id: "hamburg-6",
      name: "Altona Scandinavian Flat",
      subtitle: "Oct 18–22 · Individual host",
      price: "$165 for 4 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuABaH8YLJYy97YG47uTbqmCr9y4VmDcuYPgzDAkzcclE_qvRamzpic9HC0Os_nS4IoC8MJ56oGRq7o26W7XBlsHFdJYme1h-Ut_83xShIHcrPugeQBvorgMc4F_VtMlY8PuCUeefWnjt41CxwamzOR4otNE-_UbWnH8WasaW0v9MVXnTvrS46RwuI0w6CsKRl1az-KvCZXX_-vb1LFqblRb5wrFHkgvCDE9Z-0YthAnL7reVzljKofPew",
    },
  ];

  // Section 3: Available in Berlin this weekend
  const berlinCards: PropertyCardData[] = [
    {
      id: "berlin-1",
      name: "Mitte Designer Industrial Loft",
      subtitle: "This weekend · Individual host",
      price: "$210 for 2 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDddcT0nefLycylNiOWH9xzdYENDvRJ_WZZgd2ywCUhalq-UdUdDOve1W4cnFkkQB8ti80gACesOy1XQ_xm5zEmMBvr1R2ibOQPcV7vN62Q02ltJYx9ZWgPZ7wttdfc5n2xiOP_bZ7FOxlaH2pYZ1HkrEOt3GzPgTIuf4HYPx50Jw9gSuS0VUbmNInYEOmv6xJc86ZcAYqyirbb16utM02mt-867qyRd9Hv7y4FKe9kDQ6QezCkC1iIHQ",
    },
    {
      id: "berlin-2",
      name: "Kreuzberg Creative Studio",
      subtitle: "This weekend · Individual host",
      price: "$155 for 2 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBtHmqF_5N2FfWVEvv2618eGJKpfRSoPOfD4q1hCNU6xWhZtSuV2VXWW-UbOn8-Wdo1CIaqcDTS7-jXDZ5nvMsQgZAPP3rguni8n-Jk0d1L_JHO9aRhDgP_67gvMIVpiP8xSwlQS9JTBCc1WzIPd5NU5-m1vq6Vr0yNcAsK2lcY6VnSR_g3MHt51HjIKoKPlO84lz-0gDQaQeP6NCMpFPm79cy2MMwLvpndc4CesCzqUyf5vvwUfcBDyA",
    },
    {
      id: "berlin-3",
      name: "Prenzlauer Berg Sunny Flat",
      subtitle: "This weekend · Superhost",
      price: "$190 for 2 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDIZ6JnMUqkygt8CFBqIlWx4zbeeFlrZna4rdbRSx1chGA_YFCFmwzafRbp6rno6BvpWsquK2TaR3NOOEFY0mafHx1k3jzEvQtxPhVlpugAdkY38sqcFtWRBiSdg2J9voqihDDqacXhk1pg_MO4tUsT6cIIZr9Niw47SwmJuR4YZVU25EhAHFEWd9WWbjgfUQQxsWIE8t637iPpWvr0XLWxv0yVga-ByaDhy_tPwBsVAK8oApDOSifYvw",
    },
    {
      id: "berlin-4",
      name: "Friedrichshain Vintage Condo",
      subtitle: "This weekend · Individual host",
      price: "$140 for 2 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAbUW_WlwRzMvrsH98kVcPa5O_ZnN9XaxgkV9gphWn-Ey0poshMp0vfEZOTmJS0ZAYt4Ufu_i57x18QSf4jU7eJo2W4sl6ncoiocphBMwa9dpvZz9pMOmoXEhivXBf0laaxtTBOqLLWpNIfeZDahfOeYjNL0C3M6RrCLIqKHIFriqnnz5JvhWPBGDTxh0-nMVnMVSFSm7uGAcbwmRqa7prL8kRih9cpnILMo4LV4TX2-191riwdmsyYgg",
    },
    {
      id: "berlin-5",
      name: "Neukölln Modern Apartment",
      subtitle: "This weekend · Individual host",
      price: "$135 for 2 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBmvd_VMbguR0iVMP1CRxLecmKZWW49swQ1tq4bVMn7m6N3gpcJcmtzhbBUGfuTvARHWoKCiZz_-FQ7qqVG2BeNpWa0dVz-0zcj_gkctnB2v1nk9o3pUyFPF5PM58XLpAhFJTMY3B2HQin-yyOpyOfv42HMj8UHua-GuSe4Xle0Ol7otPdUjQ5uCpWny2A1aUDE2IKvD9Q0P41lIGwzlCM8hDJa-_-UT_D1j5RL0-oXuDaVYceSgyZhyA",
    },
    {
      id: "berlin-6",
      name: "Charlottenburg Elegance",
      subtitle: "This weekend · Superhost",
      price: "$225 for 2 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCELE4rTKsHos544wu3nH1CnZqFBLqSnjTVFBYP5XRKVHxVZXCqTd88IfFL3LHpnAO3tXvERqZIGXykUIwGALmbzbf5_OMYe3H70tt75HYBzyXr1g4U8aEroM5-L-kgzu0z0JR_LbuEDpJb_uND9cYWqNFELIMuCzpqA-2ivxQAhh4j972hWDN5GIScZBtHPr3rumtUVS9pJ1ajITyEdj4Lg_uKPwDe6N8jl4Yv2Tik9cwi2iN37CUXAQ",
    },
  ];

  // Section 4: Available next month in Barcelona
  const barcelonaCards: PropertyCardData[] = [
    {
      id: "barcelona-1",
      name: "Eixample Terrace Penthouse",
      subtitle: "Oct 10–15 · Individual host",
      price: "$275 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDnjZYNMG4KlFshtMWesxRqmnruJg5ycUbOCZV9PM8O102tGp8-e7OqX68q06loFsBzklcQ6UEU-62Ys-6--yrhWip4MrPCylBZ--v_Xbd-qUJhZIzmGsJEBT07Kq7G6U9ybbjI00CV5LeWXaiqOCR9d47lxXhyn7f4ENb-Q-g1KBm0zwspU_IyW9kZxt4O3gbvNoDgHHHHdqZXLOF5rTpiuelPa1XiZDCBjsa7aUw_VHKtH_3hfE2rRQ",
    },
    {
      id: "barcelona-2",
      name: "Gothic Quarter Historic Suite",
      subtitle: "Oct 14–19 · Individual host",
      price: "$210 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDqRPUgpv3sLk-WTPA3pIWG_onRq5nN_KzpEMn950a5zl1QFsybNq1-93iV_mSCBIyPD35mamIcevhTG6jmzI5otrN09uKIj5eymt-STRSGNjRDlIkCWLqDvVObAmmEp8jtUIxgq1XWRYde46f9vXR0tNs1rucbQCtsaOAuhMJ1kKU-ahNnJneZWllq2NpHWzr9dKuo1IfDJ96Xh2W6_y6bA4MYnG8mehniiiHnMuRnp9qL9QlWT5ie7A",
    },
    {
      id: "barcelona-3",
      name: "Gràcia Bohemian Apartment",
      subtitle: "Oct 18–23 · Superhost",
      price: "$180 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuATy7xZtUhL2wicQu3sI0g2WGLUm2A5IjWEiGROufZMCKd3RFlIw3vr4abb4ws3IhWC1DVcBAq2NfFwT95Ccjiyq-KQ66SUyPUWeoLthdc73yZa0EGAPzNICL4x2RWN8U-eQv8osNZnqfMf16WHjnCXkqlvElPCO6jgKweYdS5RwkRLLPuWFW3XUX1IbAw1-3DpUvvBGh6hibo5d5wBjZuY-NhfMfeF3oN5SgAn_kEau6O7nQhMefJX6w",
    },
    {
      id: "barcelona-4",
      name: "Barceloneta Beach Villa",
      subtitle: "Oct 20–25 · Individual host",
      price: "$340 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCi1LsoeRvScCQE35msQHGN3pylyMA5O77QtbhyHElraIWZzaFuBodIvZbkCamke_6EhR06Gkux7c4xu4VQ2aeeSKJbzGecBuv-gy3dNGVTahZm2c1ag8KiSX8oUbxvb2si0uXU1lxyJjHKEeq1drGS3IvGqS1ELFWv9wdcjNAQzNrYxXXeAur_7GRCKQxeAEvKezDsyBkiVUCmBcArbRw5M59xyoRT3E6OX8DQVCP-LQobPXbozmYI0Q",
    },
    {
      id: "barcelona-5",
      name: "El Born Modern Design Haven",
      subtitle: "Oct 22–27 · Superhost",
      price: "$230 for 5 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBi1wPl2G1Wt1BBayecdrTpnUb9w0uQVevKQbh0VaGxkUr_i-yBnvotLxTXhs7I_WTFDclhWte0OyjqICew48BQE_ilDYnMkMxd30T-z9iwJAvCWmozbU-8InzexXK0qTshkb0F4W1vK58i0Es_e8G4khmxP0HbDka5pRNJQnsJQCmJPxqVB0_CuhFaOIKbkIWf-jQEwVlSAvO9vgaLEU3DF3GlGF9GNS3cqVjvuyG6pg4olwOs8fl0mg",
    },
    {
      id: "barcelona-6",
      name: "Sagrada Família View Flat",
      subtitle: "Oct 25–30 · Superhost",
      price: "$290 for 5 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuC2ZVeJWCCDUyNnYUhKrbNMZFxEil8DgJ6SL0BO4QDZdfkQSnMXpJVAckbG1jUxPk6H_1DBapn8V9GwXhRDBaKOmp6hCNsscf3ZqUg995OlhQYiQTCSFpDZh4nPnGZf4N8EPp6GaT4aniwYdCq_GDiNUCxa69-gF3vKoLwtoK1hzSRMVrv1AmhALRynfkedh6ZALBcXFAnqI1fK8EjeMnvm4QLvX2nsQtLnVmMko8RB3zM8aYbN9BXn6w",
    },
  ];

  // Section 5: Homes in Milan
  const milanCards: PropertyCardData[] = [
    {
      id: "milan-1",
      name: "Brera Fashion District Suite",
      subtitle: "Sep 12–16 · Superhost",
      price: "$310 for 4 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAzRZA352lRsR4tOrXmAT6VUmsUWjDzxWNPyUQWKoLYSyiVVd5tC5H1VQBbRMEeX8nh54INtDwJYoLaFkjftKDRBtJkofOCutRqAHi37fF3ZNWAvYzHK2VGvF3ljg4UZ0cH5VTyaN0TPqpn2E80ZfMqsv3-LijK1adjN5AaUivxZg3xSupUObIFV7JUqnSlyLyiDcz_qjlM98Q97S6vSqGcm5Kigub1BidUrDLHI2tYPk9XF24rQnp5PA",
    },
    {
      id: "milan-2",
      name: "Navigli Waterfront Apartment",
      subtitle: "Sep 18–22 · Superhost",
      price: "$220 for 4 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuABwVkVtGAtxZj7rF-d_3GQfjNMsk7_FZGu5qEtV5VQSNNZqNDTtpYwyzX1knJ-9GUNuHECQ6nIraurbNlRwxiHM5CuUK-BOy5oD2HZ44QA9-pojnPF3g_G4UNgp5pOb-svLugBUqSUeAtFgs2Rphl6pj2iDc1jHIB6ihmn5vHY27IfIqxo_xjXcjTgkbmIkaLQBqSZqnGl8A9iolMMtNyPQIwDHQdhEkd_0HL7YsduvkZOZi9rXFtPOg",
    },
    {
      id: "milan-3",
      name: "Duomo Luxury Residence",
      subtitle: "Oct 1–5 · Superhost",
      price: "$390 for 4 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCx-wUH7E0MeOWgsNnm_fn-NE198nwYEGbRgIti4UfM3r81GXvwLp5CgKlPYpc6f_y9HgGpCjJj0MFTy4g_zltDkUEGT8kYqS4H6ctBG2c32v3x1FrAbDTptH5__rFz-dZ_pymq7qQBDC-mtDsZP2SRhLHp7gLeKGu-zr0QQq0sojdKW3HrbzjjJAgAg0m1LZcjGUl6qWncRPPzJ1u4vs2iEULzs-ggZxy9sfkFz5rF7uxpwdhVa4HRiA",
    },
    {
      id: "milan-4",
      name: "Isola Contemporary Loft",
      subtitle: "Oct 8–12 · Individual host",
      price: "$240 for 4 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuA7j7gg47HZr6nURVZeQVNotjH_yBbY4FqdGWEPsfQzfx75czrcbROyoQn6aBDsuqebm3QNkN96JyZ-rQ1rklggyWzqy2g37mVqM4Jl6zMVZKJXpVAJyU52v2DSuqu913Cgw012PqEwhGLtc-AkJ_E-7LJb4JIldGMpidtL4S6rclHr3oVS1hRKGFQwGASSbRqR9WPGuEFl_nh-nnwPJgekEHVnCtnThzcyVI8j4S1mjZdLjqW3Vdq8jw",
    },
    {
      id: "milan-5",
      name: "Porta Nuova Terrace Flat",
      subtitle: "Oct 15–19 · Individual host",
      price: "$265 for 4 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDW_-RFGMrHdDfVYxQJKivS28ghDpmVSWi-EHW3N_56vqO1vlI3u4BVlF3JbVF36lLUy7CNPiT0J30ouj2pegjqyQfHmYXRIg11Jw8EOs3x3--ynl5uaN_tYL08d55lXM98ReQTQ8ttY4_08KNvr4gxyk1kNOa5THQ2D5GWoOaqYJGyANPHbkdE-CLZy8bnAF3Tl7RSggu0eUnp85croIwLz7gz1SGYVpONNyYLB-3PSN61lM_PCw1Y4g",
    },
    {
      id: "milan-6",
      name: "San Babila Elegant Studio",
      subtitle: "Oct 20–24 · Individual host",
      price: "$205 for 4 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBuCh1hQWParRP3ILQ0I_TuyEtRneS7YuvfumMJIltQ6p5ice57Fv2MjhtM7Lb9-Njs-vG9FPFlKrHkrV7BzUbyNJTXhIXPobTATJi3xSxCFRCyLrNVfFBjPeNlvN7ai7v3HaeL2j8MjGUVTDr6Yf377iobqYREzPCNwcz4C-Shf9bWGDdQCJz8xBlJIgecPa-BLoxRFPHiuHKd0wbJJf9H_Dk3Gd3kNjAajrT0l1DQFZmOlB9ifjdJFQ",
    },
  ];

  // Section 6: Available next month in Lisbon
  const lisbonCards: PropertyCardData[] = [
    {
      id: "lisbon-1",
      name: "Alfama Historic Riverview Apartment",
      subtitle: "Oct 5–10 · Individual host",
      price: "$170 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCgPTJsfSli5BQTqvrs4MCzEKHkNUq9gkjo8qKQrWiCnyrGvulwNzMLnIb82q9FKTokkgfYij0KPprzq3lK-TpMHFinGEjZx46eFj7zzu75vv2O2VN_NslaJS0jvx9k1RffBiigmnPkWb0vDJCh4jiPeI_w0IpHWtYk4evRCcNmnRp4mKvlGLaibbEPa-3vOFHlrrrb1GzRPn5S8nXebbvv2VdSokCJdrmmWUUJ2aR-5YQtnm69UD0Lzw",
    },
    {
      id: "lisbon-2",
      name: "Baixa Chiado Sunshine Flat",
      subtitle: "Oct 11–16 · Individual host",
      price: "$195 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAGSfjX7bBxGfFxj71aTQGN0sF02tG5FumX8PV6uNXnPofE96o1mGTwjCIEiI7NWHYepbHPAdQ9jofTQIxJ8sHQzfPByLkMCQZIlsbymcaPCkZk00pPQDaiIdHK1N7VjQuiZ1EmyOPE-lmHzrwVicwxPwM2hEiMjmf7I0ZSWdLzyqsz3famXl7sjYJPiW2NRwnsAIAY_Ixe-tlgWY2YUXIDepKws4BeG6p93arhj3iL0TXNQ0i9hpmz6g",
    },
    {
      id: "lisbon-3",
      name: "Bairro Alto Cozy Suite",
      subtitle: "Oct 16–21 · Superhost",
      price: "$150 for 5 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAa1g1c00ZjQPuBVwWIZLCxHrFGnB1TEJpV03oIo7X4_KvYX9oAZeTetteEWIPjn0moDU8cOhha_qxLPwMYxn7vCUa_zuDDFKyYVGcfPR5mzIgzyhx2OB-fZBF5e2fx-l0R9Ewa5bu5PpGHTHxBIB3Gb2l0vjZUrzHR0JN8V_TGvq65c5RYKTOy7trjbm-zquCmBOkoTZz6DJTn4S_p5n-1cGSdyhaEkKFUoJwlk8CRDlJ-FsfmJssglQ",
    },
    {
      id: "lisbon-4",
      name: "Príncipe Real Garden Loft",
      subtitle: "Oct 20–25 · Superhost",
      price: "$215 for 5 nights",
      rating: "5.0",
      badge: "superhost",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCSj-RM_LAtpLRhsVDplwP7e6o3QwLG327T3AuGhAxUlljH-22mro5WCFIKN3FPuvcHY-MowAwOoYa1gtek5TqtB_jyHvBv4ynSnquwwxG76tG3LNwPjBE7RGtv7RI3BR4kuRpmvZUlLMmUKhhYKtMwE0KK_CUon3JmUdYwCkxs1nLnpt_uMfsTLQgjpvN9-yczsVV2nr57VZ9oaKEoQtfMcRzGNPefaLLStD3w8EiHJMjG4F6q7HYKiw",
    },
    {
      id: "lisbon-5",
      name: "Graça Panoramic Terrace House",
      subtitle: "Oct 23–28 · Individual host",
      price: "$185 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBfeW8vLhAclEPn_Ypg1DzHsN6A9jC2rogB33cPXJos47h8dvYq-yYYlu4dfO6OmVIY5H1JKH9CLQ59dEyULQ3eyO6gaIxr_KRcol5n_b5vVr7ahE-gv-2juaezwVCGkxKrf9WiZgtUnUn3QJp9DU_bVBS_vMznYnxOE6MyXEQcDyHpxSAcrF0rITNFV1qxSN506G4Z1UNI0ya9cmL6CFTmrht88oBTMW2kFBPVp-SxDDFjpNFuXwMThg",
    },
    {
      id: "lisbon-6",
      name: "Belém Waterfront Retreat",
      subtitle: "Oct 26–31 · Individual host",
      price: "$165 for 5 nights",
      rating: "5.0",
      badge: "guest_favorite",
      imageUrl:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuC3XlS-PgFQ_lBorGxGH5o5JjasGCUK5b7pmVSLixksEO4ubhhdchtH5orOP-0Vi2xv0Sbu3STUhIgSxNO71nOjKgDibXVNI21MfHqHAkBDQmrNHQpqOSUicFsIYJuuZl49RenHSs-HPXEQpOsKJmIpo-q52PILqHE8f8L6rp_QSfSOOvp2tUtQDM7-XJTtJQe2g2-R9GJCCFxNwD8iRI6cftKK-glPY2QRKphuVKrdGpxtwN1zWSicrw",
    },
  ];

  return (
    <div className="bg-[#FCFCFC] text-[#222222] font-sans antialiased min-h-screen flex flex-col">
      {/* App Header */}
      <AppHeader />

      {/* Main Content */}
      <main className="flex-1 max-w-[1440px] mx-auto px-6 lg:px-12 w-full pt-8 pb-16">
        {/* Hero Section */}
        <HeroSection
          onSearch={(params) => {
            setSearchFilter(params.destination);
          }}
        />

        {/* Listing Sections Container */}
        <div className="mt-14 space-y-16">
          <CategoryCarousel title="Popular home in Paris" cards={parisCards} />
          <CategoryCarousel title="Stay in Hamburg" cards={hamburgCards} />
          <CategoryCarousel
            title="Available in Berlin this weekend"
            cards={berlinCards}
          />
          <CategoryCarousel
            title="Available next month in Barcelona"
            cards={barcelonaCards}
          />
          <CategoryCarousel title="Homes in Milan" cards={milanCards} />
          <CategoryCarousel
            title="Available next month in Lisbon"
            cards={lisbonCards}
          />
        </div>
      </main>

      {/* Existing Built Footer */}
      <Footer />
    </div>
  );
}
