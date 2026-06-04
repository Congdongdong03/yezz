import type { FastifyInstance } from "fastify";
import type {
  GalleryImageCreateInput,
  GalleryImageUpdateInput,
} from "../../../repositories/gallery.repository.js";
import { success } from "../../../lib/response.js";

export default async function adminGalleryRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const data = await app.services.adminGallery.list();
    return success(data);
  });

  app.get<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminGallery.getById(request.params.id);
    return success(data);
  });

  app.post<{ Body: GalleryImageCreateInput }>("/", async (request) => {
    const data = await app.services.adminGallery.create(request.body);
    return success(data);
  });

  app.patch<{ Params: { id: string }; Body: GalleryImageUpdateInput }>(
    "/:id",
    async (request) => {
      const data = await app.services.adminGallery.update(
        request.params.id,
        request.body,
      );
      return success(data);
    },
  );

  app.delete<{ Params: { id: string } }>("/:id", async (request) => {
    const data = await app.services.adminGallery.delete(request.params.id);
    return success(data);
  });
}
