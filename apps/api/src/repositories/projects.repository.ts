import {
  diyProjects,
  projectCategories,
  projectImages,
  projectStyles,
  type Db,
  type LocalizedString,
} from "@yezz/db";
import { asc, count, eq } from "drizzle-orm";

export type ProjectStyleInput = {
  name: LocalizedString;
  imageUrl?: string | null;
  price?: string | null;
  sortOrder?: number;
};

export type ProjectImageInput = {
  url: string;
  sortOrder?: number;
};

export type ProjectCreateInput = {
  categoryId: string;
  name: LocalizedString;
  slug: string;
  projectType: "experience" | "product";
  description?: LocalizedString | null;
  priceRange?: string | null;
  duration?: string | null;
  tags?: string[] | null;
  sortOrder?: number;
  coverImageUrl?: string | null;
  styles?: ProjectStyleInput[];
  images?: ProjectImageInput[];
};

export type ProjectUpdateInput = Partial<
  Omit<ProjectCreateInput, "styles" | "images">
> & {
  styles?: ProjectStyleInput[];
  images?: ProjectImageInput[];
};

export function createProjectsRepository(db: Db) {
  return {
    findAllWithCategory() {
      return db
        .select({
          project: diyProjects,
          category: projectCategories,
        })
        .from(diyProjects)
        .innerJoin(
          projectCategories,
          eq(diyProjects.categoryId, projectCategories.id),
        )
        .orderBy(asc(diyProjects.sortOrder));
    },

    async countAll() {
      const [row] = await db.select({ value: count() }).from(diyProjects);
      return Number(row?.value ?? 0);
    },

    findAllWithCategoryPaginated(limit: number, offset: number) {
      return db
        .select({
          project: diyProjects,
          category: projectCategories,
        })
        .from(diyProjects)
        .innerJoin(
          projectCategories,
          eq(diyProjects.categoryId, projectCategories.id),
        )
        .orderBy(asc(diyProjects.sortOrder))
        .limit(limit)
        .offset(offset);
    },

    async findBySlug(slug: string) {
      const [row] = await db
        .select()
        .from(diyProjects)
        .where(eq(diyProjects.slug, slug))
        .limit(1);
      return row ?? null;
    },

    async findById(id: string) {
      const [row] = await db
        .select()
        .from(diyProjects)
        .where(eq(diyProjects.id, id))
        .limit(1);
      return row ?? null;
    },

    findStylesByProjectId(projectId: string) {
      return db
        .select()
        .from(projectStyles)
        .where(eq(projectStyles.projectId, projectId))
        .orderBy(asc(projectStyles.sortOrder));
    },

    findImagesByProjectId(projectId: string) {
      return db
        .select()
        .from(projectImages)
        .where(eq(projectImages.projectId, projectId))
        .orderBy(asc(projectImages.sortOrder));
    },

    async create(data: ProjectCreateInput) {
      const [project] = await db
        .insert(diyProjects)
        .values({
          categoryId: data.categoryId,
          name: data.name,
          slug: data.slug,
          projectType: data.projectType,
          description: data.description ?? null,
          priceRange: data.priceRange ?? null,
          duration: data.duration ?? null,
          tags: data.tags ?? null,
          sortOrder: data.sortOrder ?? 0,
          coverImageUrl: data.coverImageUrl ?? null,
        })
        .returning();

      if (!project) return null;

      if (data.styles?.length) {
        await db.insert(projectStyles).values(
          data.styles.map((s, i) => ({
            projectId: project.id,
            name: s.name,
            imageUrl: s.imageUrl ?? null,
            price: s.price ?? null,
            sortOrder: s.sortOrder ?? i,
          })),
        );
      }

      if (data.images?.length) {
        await db.insert(projectImages).values(
          data.images.map((img, i) => ({
            projectId: project.id,
            url: img.url,
            sortOrder: img.sortOrder ?? i,
          })),
        );
      }

      return project;
    },

    async update(id: string, data: ProjectUpdateInput) {
      const { styles, images, ...fields } = data;
      const patch = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined),
      );

      let project;
      if (Object.keys(patch).length > 0) {
        const [row] = await db
          .update(diyProjects)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(diyProjects.id, id))
          .returning();
        project = row;
      } else {
        project = await this.findById(id);
      }

      if (!project) return null;

      if (styles !== undefined) {
        await db.delete(projectStyles).where(eq(projectStyles.projectId, id));
        if (styles.length > 0) {
          await db.insert(projectStyles).values(
            styles.map((s, i) => ({
              projectId: id,
              name: s.name,
              imageUrl: s.imageUrl ?? null,
              price: s.price ?? null,
              sortOrder: s.sortOrder ?? i,
            })),
          );
        }
      }

      if (images !== undefined) {
        await db.delete(projectImages).where(eq(projectImages.projectId, id));
        if (images.length > 0) {
          await db.insert(projectImages).values(
            images.map((img, i) => ({
              projectId: id,
              url: img.url,
              sortOrder: img.sortOrder ?? i,
            })),
          );
        }
      }

      return project;
    },

    async delete(id: string) {
      const [row] = await db
        .delete(diyProjects)
        .where(eq(diyProjects.id, id))
        .returning({ id: diyProjects.id });
      return row ?? null;
    },
  };
}
