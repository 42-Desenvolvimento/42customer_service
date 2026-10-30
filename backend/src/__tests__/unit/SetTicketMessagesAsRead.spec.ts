jest.mock("../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../services/TicketServices/ShowTicketService", () => jest.fn());

jest.mock("../../helpers/socketEmit", () => jest.fn());

jest.mock("../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

const Message = require("../../models/Message").default;
const GetTicketWbot = require("../../helpers/GetTicketWbot") as jest.Mock;
const ShowTicketService = require(
  "../../services/TicketServices/ShowTicketService"
) as jest.Mock;
const socketEmit = require("../../helpers/socketEmit") as jest.Mock;
const {
  StartWhatsAppSessionVerify
} = require("../../services/WbotServices/StartWhatsAppSessionVerify");
const SetTicketMessagesAsRead = require("../../helpers/SetTicketMessagesAsRead")
  .default;

describe("SetTicketMessagesAsRead", () => {
  const buildTicket = () =>
    ({
      id: 11,
      tenantId: 22,
      whatsappId: 33,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511888888888"
      },
      update: jest.fn().mockResolvedValue(undefined)
    } as any);

  beforeEach(() => {
    Message.update.mockReset();
    GetTicketWbot.mockReset();
    ShowTicketService.mockReset();
    socketEmit.mockReset();
    StartWhatsAppSessionVerify.mockReset();
  });

  it("verifies the WhatsApp session when sendSeen rejects", async () => {
    const sendSeenError = new Error(
      "Cannot read property 'sendSeen' of undefined"
    );
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ticket = buildTicket();
    const ticketReloaded = { id: ticket.id, unreadMessages: 0 };
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);

    Message.update.mockResolvedValue([1]);
    GetTicketWbot.mockResolvedValue({ sendSeen });
    ShowTicketService.mockResolvedValue(ticketReloaded);

    await SetTicketMessagesAsRead(ticket);
    await Promise.resolve();

    expect(Message.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 11,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511888888888@c.us");
    expect(StartWhatsAppSessionVerify).toHaveBeenCalledWith(
      33,
      sendSeenError
    );
    expect(consoleError).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(ShowTicketService).toHaveBeenCalledWith({
      id: 11,
      tenantId: 22
    });
    expect(socketEmit).toHaveBeenCalledWith({
      tenantId: 22,
      type: "ticket:update",
      payload: ticketReloaded
    });

    consoleError.mockRestore();
  });
});

export {};
