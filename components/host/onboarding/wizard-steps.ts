export interface WizardStepDefinition {
  index: number;
  slug: string;
  part: 1 | 2 | 3;
  partTitle: string;
  title: string;
  subtitle?: string;
  isIntro?: boolean;
}

export const WIZARD_STEPS: WizardStepDefinition[] = [
  // Part 1: The Basics (0..6)
  {
    index: 0,
    slug: 'overview',
    part: 1,
    partTitle: 'The basics',
    title: 'Overview',
    isIntro: true,
  },
  {
    index: 1,
    slug: 'intro',
    part: 1,
    partTitle: 'The basics',
    title: 'Tell us about your place',
    isIntro: true,
  },
  {
    index: 2,
    slug: 'category',
    part: 1,
    partTitle: 'The basics',
    title: 'Which of these best describes your place?',
  },
  {
    index: 3,
    slug: 'place-type',
    part: 1,
    partTitle: 'The basics',
    title: 'What type of place will guests have?',
  },
  {
    index: 4,
    slug: 'location',
    part: 1,
    partTitle: 'The basics',
    title: 'Where is your place located?',
  },
  {
    index: 5,
    slug: 'address',
    part: 1,
    partTitle: 'The basics',
    title: 'Confirm your address',
  },
  {
    index: 6,
    slug: 'basics',
    part: 1,
    partTitle: 'The basics',
    title: 'Share some basics about your place',
  },

  // Part 2: Make it stand out (7..13)
  {
    index: 7,
    slug: 'standout',
    part: 2,
    partTitle: 'Make it stand out',
    title: 'Make your place stand out',
    isIntro: true,
  },
  {
    index: 8,
    slug: 'amenities',
    part: 2,
    partTitle: 'Make it stand out',
    title: 'Tell guests what your place has to offer',
  },
  {
    index: 9,
    slug: 'photos',
    part: 2,
    partTitle: 'Make it stand out',
    title: 'Add some photos of your place',
  },
  {
    index: 10,
    slug: 'photos-review',
    part: 2,
    partTitle: 'Make it stand out',
    title: 'Ta-da! How does this look?',
  },
  {
    index: 11,
    slug: 'title',
    part: 2,
    partTitle: 'Make it stand out',
    title: 'Now, let\'s give your place a title',
  },
  {
    index: 12,
    slug: 'highlights',
    part: 2,
    partTitle: 'Make it stand out',
    title: 'Next, let\'s describe your place',
  },
  {
    index: 13,
    slug: 'description',
    part: 2,
    partTitle: 'Make it stand out',
    title: 'Create your description',
  },

  // Part 3: Finish up (14..21)
  {
    index: 14,
    slug: 'finish-intro',
    part: 3,
    partTitle: 'Finish up and publish',
    title: 'Finish up and publish',
    isIntro: true,
  },
  {
    index: 15,
    slug: 'booking-settings',
    part: 3,
    partTitle: 'Finish up and publish',
    title: 'Pick your booking settings',
  },
  {
    index: 16,
    slug: 'price',
    part: 3,
    partTitle: 'Finish up and publish',
    title: 'Now, set your base price',
  },
  {
    index: 17,
    slug: 'weekend-price',
    part: 3,
    partTitle: 'Finish up and publish',
    title: 'Set your weekend price',
  },
  {
    index: 18,
    slug: 'discounts',
    part: 3,
    partTitle: 'Finish up and publish',
    title: 'Add discounts',
  },
  {
    index: 19,
    slug: 'safety',
    part: 3,
    partTitle: 'Finish up and publish',
    title: 'Just a few final details',
  },
  {
    index: 20,
    slug: 'registration-details',
    part: 3,
    partTitle: 'Finish up and publish',
    title: 'Add registration details',
  },
  {
    index: 21,
    slug: 'publish',
    part: 3,
    partTitle: 'Finish up and publish',
    title: 'Publish your listing',
  },
];

export const TOTAL_WIZARD_STEPS = WIZARD_STEPS.length; // 22 steps (0..21)

export function getStepByIndex(index: number): WizardStepDefinition {
  return WIZARD_STEPS[index] ?? WIZARD_STEPS[0];
}

export function getStepBySlug(slug: string): WizardStepDefinition | undefined {
  return WIZARD_STEPS.find((s) => s.slug === slug);
}
