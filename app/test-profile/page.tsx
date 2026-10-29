import { TravelProfileView } from "@/components/travel/travel-profile-view";

export default function TestProfilePage() {
  const mockProfile = {
    id: "mock-1",
    userId: "user-1",
    displayName: "Name, Surname",
    handle: "namesurname",
    homeLocation: "Town, Country",
    bio: null,
    avatarUrl: "/images/auth-traveler-water.jpg",
    coverUrl: "/images/auth-traveler-water.jpg",
    visibility: "PUBLIC" as const,
    updatedAt: new Date().toISOString(),
    user: {
      name: "Name, Surname",
      image: "/images/auth-traveler-water.jpg",
    },
  };

  const mockStats = {
    trips: 12,
    likes: 168,
    reviews: 98,
  };

  return (
    <div className="min-h-screen bg-white pt-8">
      <TravelProfileView
        initialProfile={mockProfile as any}
        initialStats={mockStats}
        initialPhotos={[]}
        initialHighlights={[]}
        initialStamps={[]}
        initialStampsTotalCount={0}
        initialDestinationStats={{} as any}
        isOwner={true}
      />
    </div>
  );
}
