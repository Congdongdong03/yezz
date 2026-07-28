import type { HomePageData } from "./data";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;

type Expect<Value extends true> = Value;
type HomePageProject = HomePageData["projects"][number];

type FeaturedProjectFields = {
  _id: string;
  name: { en: string; zh: string };
  slug: { current: string };
  imageUrl?: string;
  priceRange?: string;
  duration?: string;
  tags: string[];
};

export type HomePageProjectProvidesFeaturedProjectFields = Expect<
  HomePageProject extends FeaturedProjectFields ? true : false
>;
export type HomePageProjectUsesLocalizedCategory = Expect<
  Equal<HomePageProject["category"], { en: string; zh: string }>
>;
