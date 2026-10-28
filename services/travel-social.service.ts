import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { notificationService } from "@/services/notification.service";
import { canAccessTravelPhoto, canAccessTravelTrip } from "@/services/travel-privacy.service";
import type { TravelPhotoCommentDTO, TravelTripDTO } from "@/types/travel";

const COMMENT_LIMIT = 1_000;

function sanitizeComment(value: unknown): string {
  if (typeof value !== "string") throw AppError.badRequest("Comment text is required.");
  const content = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!content) throw AppError.badRequest("Comment text is required.");
  if (content.length > COMMENT_LIMIT) throw AppError.badRequest(`Comments must be ${COMMENT_LIMIT} characters or fewer.`);
  return content;
}

function toCommentDTO(comment: {
  id: string; photoId: string; userId: string; content: string; createdAt: Date; updatedAt: Date;
  user: { id: string; name: string | null; image: string | null; travelProfile: { handle: string | null } | null };
}, actorId: string | null | undefined, photoOwnerId: string): TravelPhotoCommentDTO {
  const canModerate = actorId === photoOwnerId;
  return {
    id: comment.id, photoId: comment.photoId, userId: comment.userId, content: comment.content,
    createdAt: comment.createdAt, updatedAt: comment.updatedAt,
    author: { id: comment.user.id, name: comment.user.name, image: comment.user.image, handle: comment.user.travelProfile?.handle || null },
    canEdit: actorId === comment.userId,
    canDelete: canModerate || actorId === comment.userId,
  };
}

export async function toggleTripLike(actorId: string, tripId: string): Promise<{ liked: boolean; count: number }> {
  const trip = await prisma.travelTrip.findUnique({ where: { id: tripId }, select: { id: true, userId: true, title: true } });
  if (!trip) throw AppError.notFound("Travel trip not found.");
  if (!(await canAccessTravelTrip(actorId, tripId)).canAccess) throw AppError.forbidden("You cannot like this trip.");
  if (trip.userId === actorId) throw AppError.badRequest("You cannot like your own trip.");
  const key = { actorId_tripId: { actorId, tripId } };
  const existing = await prisma.travelTripLike.findUnique({ where: key });
  if (existing) {
    await prisma.travelTripLike.delete({ where: key });
  } else {
    const like = await prisma.travelTripLike.create({ data: { actorId, tripId } });
    void notificationService.create({
      userId: trip.userId, type: "SYSTEM", title: "New trip like", message: "Someone liked your travel trip.",
      entityId: like.id, entityType: "travel-trip-like", link: "/travel-profile",
    }).catch(() => {});
  }
  const count = await prisma.travelTripLike.count({ where: { tripId } });
  const liked = Boolean(await prisma.travelTripLike.findUnique({ where: key }));
  return { liked, count };
}

export async function getTripLikeStatus(actorId: string | null | undefined, tripId: string): Promise<{ liked: boolean; count: number }> {
  if (!(await canAccessTravelTrip(actorId, tripId)).canAccess) throw AppError.forbidden("You cannot access this trip.");
  const [count, like] = await Promise.all([
    prisma.travelTripLike.count({ where: { tripId } }),
    actorId ? prisma.travelTripLike.findUnique({ where: { actorId_tripId: { actorId, tripId } }, select: { id: true } }) : null,
  ]);
  return { liked: Boolean(like), count };
}

export async function getTravelTripDetails(actorId: string | null | undefined, tripId: string): Promise<TravelTripDTO> {
  if (!(await canAccessTravelTrip(actorId, tripId)).canAccess) throw AppError.forbidden("You cannot access this trip.");
  const trip = await prisma.travelTrip.findUnique({
    where: { id: tripId },
    include: {
      _count: { select: { photos: true, likes: true } },
      likes: actorId ? { where: { actorId }, select: { id: true } } : false,
      photos: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], include: { _count: { select: { likes: true, comments: true } }, likes: actorId ? { where: { actorId }, select: { id: true } } : false } },
    },
  });
  if (!trip) throw AppError.notFound("Travel trip not found.");
  return {
    id: trip.id, userId: trip.userId, title: trip.title, destinationId: trip.destinationId,
    startDate: trip.startDate, endDate: trip.endDate, coverPhotoId: trip.coverPhotoId,
    coverUrl: trip.photos.find((photo) => photo.id === trip.coverPhotoId)?.mediumUrl || trip.photos[0]?.mediumUrl || trip.photos[0]?.url || null,
    status: trip.status, visibility: trip.visibility, photoCount: trip._count.photos, remainingCapacity: Math.max(0, 5 - trip._count.photos),
    likesCount: trip._count.likes, isLiked: Array.isArray(trip.likes) && trip.likes.length > 0,
    photos: trip.photos.map((photo) => ({ id: photo.id, userId: photo.userId, tripId: photo.tripId, tripTitle: trip.title, url: photo.url, thumbnailUrl: photo.thumbnailUrl || photo.url, mediumUrl: photo.mediumUrl || photo.url, caption: photo.caption, location: photo.location, order: photo.order, visibility: photo.visibility, likesCount: photo._count.likes, commentsCount: photo._count.comments, isLiked: Array.isArray(photo.likes) && photo.likes.length > 0, createdAt: photo.createdAt, updatedAt: photo.updatedAt })),
    createdAt: trip.createdAt, updatedAt: trip.updatedAt,
  };
}

export async function getPhotoComments(actorId: string | null | undefined, photoId: string, options: { cursor?: string; limit?: number } = {}) {
  const access = await canAccessTravelPhoto(actorId, photoId);
  if (!access.canAccess) throw AppError.forbidden("You cannot view comments on this photo.");
  const photo = await prisma.travelPhoto.findUnique({ where: { id: photoId }, select: { userId: true } });
  if (!photo) throw AppError.notFound("Travel photo not found.");
  const limit = Math.min(50, Math.max(1, options.limit || 20));
  const comments = await prisma.travelPhotoComment.findMany({
    where: { photoId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    include: { user: { select: { id: true, name: true, image: true, travelProfile: { select: { handle: true } } } } },
  });
  const page = comments.slice(0, limit);
  return { items: page.map((comment) => toCommentDTO(comment, actorId, photo.userId)), nextCursor: comments.length > limit ? page.at(-1)?.id || null : null, totalCount: await prisma.travelPhotoComment.count({ where: { photoId } }) };
}

export async function createPhotoComment(actorId: string, photoId: string, rawContent: unknown): Promise<TravelPhotoCommentDTO> {
  const photo = await prisma.travelPhoto.findUnique({ where: { id: photoId }, select: { userId: true } });
  if (!photo) throw AppError.notFound("Travel photo not found.");
  if (!(await canAccessTravelPhoto(actorId, photoId)).canAccess) throw AppError.forbidden("You cannot comment on this photo.");
  const comment = await prisma.travelPhotoComment.create({
    data: { photoId, userId: actorId, content: sanitizeComment(rawContent) },
    include: { user: { select: { id: true, name: true, image: true, travelProfile: { select: { handle: true } } } } },
  });
  if (photo.userId !== actorId) void notificationService.create({
    userId: photo.userId, type: "SYSTEM", title: "New photo comment", message: "Someone commented on your travel photo.",
    entityId: comment.id, entityType: "travel-photo-comment", link: "/travel-profile",
  }).catch(() => {});
  return toCommentDTO(comment, actorId, photo.userId);
}

export async function updatePhotoComment(actorId: string, commentId: string, rawContent: unknown): Promise<TravelPhotoCommentDTO> {
  const current = await prisma.travelPhotoComment.findUnique({ where: { id: commentId }, include: { photo: { select: { userId: true } } } });
  if (!current) throw AppError.notFound("Comment not found.");
  if (current.userId !== actorId) throw AppError.forbidden("Only the comment author can edit it.");
  const comment = await prisma.travelPhotoComment.update({
    where: { id: commentId }, data: { content: sanitizeComment(rawContent) },
    include: { user: { select: { id: true, name: true, image: true, travelProfile: { select: { handle: true } } } } },
  });
  return toCommentDTO(comment, actorId, current.photo.userId);
}

export async function deletePhotoComment(actorId: string, commentId: string): Promise<void> {
  const current = await prisma.travelPhotoComment.findUnique({ where: { id: commentId }, include: { photo: { select: { userId: true } } } });
  if (!current) throw AppError.notFound("Comment not found.");
  if (current.userId !== actorId && current.photo.userId !== actorId) throw AppError.forbidden("You cannot remove this comment.");
  await prisma.travelPhotoComment.delete({ where: { id: commentId } });
}
