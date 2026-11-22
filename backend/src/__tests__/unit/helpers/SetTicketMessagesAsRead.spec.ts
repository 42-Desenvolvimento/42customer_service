jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    update: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../helpers/socketEmit", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../services/WbotServices/StartWhatsAppSessionVerify", () => ({
  StartWhatsAppSessionVerify: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

import Message from "../../../models/Message";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import socketEmit from "../../../helpers/socketEmit";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";

const MessageMock = Message as unknown as { update: jest.Mock };
const GetTicketWbotMock = GetTicketWbot as jest.Mock;
const ShowTicketServiceMock = ShowTicketService as jest.Mock;
const socketEmitMock = socketEmit as jest.Mock;
const StartWhatsAppSessionVerifyMock = StartWhatsAppSessionVerify as jest.Mock;

describe("SetTicketMessagesAsRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts WhatsApp session verification when sendSeen fails", async () => {
    const sendSeenError = new Error("session closed");
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const ticketReload = { id: 12, unreadMessages: 0 };
    const ticket = {
      id: 12,
      tenantId: 4,
      whatsappId: 9,
      channel: "whatsapp",
      isGroup: false,
      contact: { number: "5511999999999" },
      update: jest.fn().mockResolvedValue(undefined)
    };

    MessageMock.update.mockResolvedValue([1]);
    GetTicketWbotMock.mockResolvedValue({ sendSeen });
    ShowTicketServiceMock.mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(MessageMock.update).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 12,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(StartWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      9,
      sendSeenError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "não foi possível marcar como lido",
      sendSeenError
    );
    expect(ShowTicketServiceMock).toHaveBeenCalledWith({
      id: 12,
      tenantId: 4
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 4,
      type: "ticket:update",
      payload: ticketReload
    });

    consoleErrorSpy.mockRestore();
  });
});

export {};
