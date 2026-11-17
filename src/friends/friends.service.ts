import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export type FriendshipStatus = 'PENDING' | 'ACCEPTED';

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notService: NotificationsService
) {}

  async findAcceptedConnections(userId: string) {
//     return this.prisma.friendship.findMany({
//       where: {
//         OR: [{ senderId: userId }, { receiverId: userId }],
//         status: 'ACCEPTED',
//       },
//       include: {
//         sender: {
//           select: {
//             id: true,
//             firstName: true,
//             lastName: true,
//             nickname: true,
//             email: true,
//             avatar: true,
//           },
//         },
//         receiver: {
//           select: {
//             id: true,
//             firstName: true,
//             lastName: true,
//             nickname: true,
//             email: true,
//             avatar: true,
//           },
//         },
//       },
//       orderBy: { createdAt: 'desc' },
//     });
   }

  async findPendingRequests(userId: string) {
    // return this.prisma.friendship.findMany({
    //   where: {
    //     receiverId: userId,
    //     status: 'PENDING',
    //   },
    //   include: {
    //     sender: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         nickname: true,
    //         email: true,
    //         avatar: true,
    //       },
    //     },
    //   },
    //   orderBy: { createdAt: 'desc' },
    // });
  }

  async createRequest(input: { userId: string; friendEmail: string }) {
    const {
        userId,
        friendEmail
    } = input;
    const normalEmail = friendEmail ? friendEmail.trim() : ''; 

    try {
        const friendUserExists = await this.prisma.user.findFirst({
            where: {
                email: {
                    equals: normalEmail,
                    mode: 'insensitive',
                },
            },
            select: { id: true, email: true },
        });
         if (!friendUserExists) {
            throw new NotFoundException('User not found.');
        }

        if (input.userId === friendUserExists.id) {
            throw new Error('You cannot add yourself as a friend.');
        }

        const existingFriendship = await this.prisma.friendship.findFirst({
            where: { 
                OR: [
                    { senderId: input.userId, receiverId: friendUserExists.id },
                    { senderId: friendUserExists.id, receiverId: input.userId },
                ],
            }
        })

        if(!existingFriendship){
            const friendship = await this.prisma.friendship.create({
                data: {
                    receiverId: friendUserExists.id,
                    senderId: userId,
                }
            }); 
            const noti = this.notService.create({
                text: "",
                title: "Solicitud de amistad"
            });
            return {
                friendship,
                noti
            }
        } 
        return existingFriendship;
    } catch (error) {
        
    }

    // console.log("HOLAAAAAAAAA")
    // const normalizedEmail = input.friendEmail?.trim();
    // if (!normalizedEmail) {
    //   throw new BadRequestException('Friend email is required.');
    // }

    // if (input.userId === normalizedEmail) {
    //   throw new Error('You cannot add yourself as a friend.');
    // }

    // const friendExists = await this.prisma.user.findFirst({
    //   where: {
    //     email: {
    //       equals: normalizedEmail,
    //       mode: 'insensitive',
    //     },
    //   },
    //   select: { id: true, email: true },
    // });


    // const existingFriendship = await this.prisma.friendship.findFirst({
    //   where: {
    //     OR: [
    //       { senderId: input.userId, receiverId: friendExists.id },
    //       { senderId: friendExists.id, receiverId: input.userId },
    //     ],
    //   },
    // });

    // if (existingFriendship) {
    //   return existingFriendship;
    // }

    // return this.prisma.friendship.create({
    //   data: {
    //     senderId: input.userId,
    //     receiverId: friendExists.id,
    //     status: 'PENDING',
    //   },
    //   include: {
    //     sender: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         nickname: true,
    //         email: true,
    //         avatar: true,
    //       },
    //     },
    //     receiver: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         nickname: true,
    //         email: true,
    //         avatar: true,
    //       },
    //     },
    //   },
    // });
  }

  async acceptRequest(id: string/** Friendship Id */, userId: string /** User acepting friendship Id */) {
    const record = await this.prisma.friendship.findUnique({
        where: {
            id: id
        }
    });
    if (!record || record.receiverId !== userId) {
      throw new NotFoundException('Friend request not found.');
    }
    const consolidate = await this.prisma.$transaction(
        async (tx) => {
            const friendship = await tx.friendship.update({
                where: { id: id },
                data: { status: "ACCEPTED" }
            });

            if (friendship.status !== "ACCEPTED") {
                throw new Error("No se pudo aceptar");
            }

            const notiResponse = await this.notService.create({
                title: "Solicitud de amistad aceptada",
                text: `${userId} ha aceptado tu solicitud de amistad`,
            })
        }
    ); 
    return consolidate
    // const record = await this.prisma.friendship.findUnique({
    //   where: { id },
    //   include: {
    //     sender: true,
    //     receiver: true,
    //   },
    // });

    // if (!record || record.receiverId !== userId) {
    //   throw new NotFoundException('Friend request not found.');
    // }

    // return this.prisma.friendship.update({
    //   where: { id },
    //   data: { status: 'ACCEPTED' },
    //   include: {
    //     sender: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         nickname: true,
    //         email: true,
    //         avatar: true,
    //       },
    //     },
    //     receiver: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         nickname: true,
    //         email: true,
    //         avatar: true,
    //       },
    //     },
    //   },
    // });
  }

  async rejectRequest(id: string, userId: string) {
    const record = await this.prisma.friendship.findUnique({
        where: {
            id: id
        }
    });
    if (!record || record.receiverId !== userId) {
      throw new NotFoundException('Friend request not found.');
    }
    const consolidate = await this.prisma.$transaction(
        async (tx) => {
            const friendship = await tx.friendship.update({
                where: { id: id },
                data: { status: "REJECTED" }
            });

            const notiResponse = await this.notService.create({
                title: "Solicitud de amistad rechazada",
                text: `${friendship}`,
            });

            const del = await tx.friendship.delete({
                where: {
                    id: id,
                    status: "REJECTED"
                }
            })
            return {
                del,
                notiResponse
            }
        }
    ); 
    return consolidate
    // const friendship = await this.prisma.friendship.findUnique({
    //   where: { id },
    //   select: { id: true, senderId: true, receiverId: true },
    // });

    // if (!friendship || (friendship.senderId !== userId && friendship.receiverId !== userId)) {
    //   throw new NotFoundException('Friend request not found.');
    // }

    // return this.prisma.friendship.delete({
    //   where: { id },
    //   include: {
    //     sender: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         nickname: true,
    //         email: true,
    //         avatar: true,
    //       },
    //     },
    //     receiver: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         nickname: true,
    //         email: true,
    //         avatar: true,
    //       },
    //     },
    //   },
    // });
  }

  async removeRelationship(id: string, userId: string) {
    // const friendship = await this.prisma.friendship.findUnique({
    //   where: { id },
    //   select: { id: true, senderId: true, receiverId: true },
    // });

    // if (!friendship || (friendship.senderId !== userId && friendship.receiverId !== userId)) {
    //   throw new NotFoundException('Friendship not found.');
    // }

    // return this.prisma.friendship.delete({
    //   where: { id },
    //   include: {
    //     sender: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         nickname: true,
    //         email: true,
    //         avatar: true,
    //       },
    //     },
    //     receiver: {
    //       select: {
    //         id: true,
    //         firstName: true,
    //         lastName: true,
    //         nickname: true,
    //         email: true,
    //         avatar: true,
    //       },
    //     },
    //   },
    // });
  }
}
