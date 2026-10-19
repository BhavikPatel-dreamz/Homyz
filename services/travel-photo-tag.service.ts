import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { PhotoTagDto } from "@/lib/validation/travel-trip";

function toTagDto(tag: {
  id: string;
  photoId: string;
  taggedUserId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: Date;
  taggedUser: {
    id: string;
    name: string | null;
    image: string | null;
  };
}): PhotoTagDto {
  return {
    id: tag.id,
    photoId: tag.photoId,
    taggedUserId: tag.taggedUserId,
    status: tag.status,
    user: {
      id: tag.taggedUser.id,
      name: tag.taggedUser.name,
      image: tag.taggedUser.image,
    },
    createdAt: tag.createdAt.toISOString(),
  };
}

export async function listPhotoTags(actorId: string, photoId: string): Promise<PhotoTagDto[]> {
  const photo = await prisma.travelPhoto.findUnique({
    where: { id: photoId },
    select: { id: true, userId: true, deletedAt: true },
  });

  if (!photo || photo.deletedAt) {
    throw AppError.notFound("Photo not found.");
  }

  const tags = await prisma.travelPhotoTag.findMany({
    where: { photoId },
    include: {
      taggedUser: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return tags.map(toTagDto);
}

export async function addPhotoTag(
  actorId: string,
  photoId: string,
  taggedUserId: string,
): Promise<PhotoTagDto> {
  const photo = await prisma.travelPhoto.findUnique({
    where: { id: photoId },
    select: { id: true, userId: true, deletedAt: true },
  });

  if (!photo || photo.deletedAt || photo.userId !== actorId) {
    throw AppError.notFound("Photo not found or unauthorized.");
  }

  if (taggedUserId === actorId) {
    throw AppError.badRequest("You cannot tag yourself.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: taggedUserId },
    select: { id: true, name: true, image: true, status: true },
  });

  if (!targetUser || targetUser.status !== "ACTIVE") {
    throw AppError.notFound("Target user not found or unavailable.");
  }

  // Check mutual blocks
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: actorId, blockedId: taggedUserId },
        { blockerId: taggedUserId, blockedId: actorId },
      ],
    },
  });

  if (block) {
    throw AppError.forbidden("Cannot tag this user due to account privacy settings.");
  }

  // Check if tag already exists
  const existing = await prisma.travelPhotoTag.findUnique({
    where: {
      photoId_taggedUserId: {
        photoId,
        taggedUserId,
      },
    },
  });

  if (existing) {
    throw AppError.badRequest("User is already tagged in this photo.");
  }

  const newTag = await prisma.travelPhotoTag.create({
    data: {
      photoId,
      taggedUserId,
      status: "PENDING",
    },
    include: {
      taggedUser: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  return toTagDto(newTag);
}

export async function removePhotoTag(
  actorId: string,
  photoId: string,
  tagId: string,
): Promise<{ success: true }> {
  const tag = await prisma.travelPhotoTag.findUnique({
    where: { id: tagId },
    include: {
      photo: {
        select: { id: true, userId: true },
      },
    },
  });

  if (!tag || tag.photoId !== photoId) {
    throw AppError.notFound("Tag not found.");
  }

  // Allowed if actor is photo owner OR tagged user
  if (tag.photo.userId !== actorId && tag.taggedUserId !== actorId) {
    throw AppError.forbidden("You do not have permission to remove this tag.");
  }

  await prisma.travelPhotoTag.delete({
    where: { id: tagId },
  });

  return { success: true };
}

export async function searchTaggableUsers(
  actorId: string,
  query: string,
): Promise<Array<{ id: string; name: string | null; image: string | null }>> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  // Find blocked user IDs to exclude
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [{ blockerId: actorId }, { blockedId: actorId }],
    },
    select: { blockerId: true, blockedId: true },
  });

  const excludedIds = new Set<string>([actorId]);
  for (const b of blocks) {
    excludedIds.add(b.blockerId === actorId ? b.blockedId : b.blockerId);
  }

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: Array.from(excludedIds) },
      status: "ACTIVE",
      name: { contains: clean, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      image: true,
    },
    take: 10,
    orderBy: { name: "asc" },
  });

  return users;
}

