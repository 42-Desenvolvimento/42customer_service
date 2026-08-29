jest.mock("../../../libs/messengerBot", () => ({
  getMessengerBot: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  update: jest.fn()
}));

jest.mock("../../../services/TicketServices/ShowTicketService", () =>
  jest.fn()
);

jest.mock(
  "../../../services/WbotServices/StartWhatsAppSessionVerify",
  () => ({
    StartWhatsAppSessionVerify: jest.fn()
  })
);

jest.mock("../../../utils/logger", () => ({
  logger: {
    warn: jest.fn()
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => jest.fn());

jest.mock("../../../helpers/socketEmit", () => jest.fn());

import SetTicketMessagesAsRead from "../../../helpers/SetTicketMessagesAsRead";
import Message from "../../../models/Message";
import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import socketEmit from "../../../helpers/socketEmit";

describe("SetTicketMessagesAsRead", () => {
  const messageUpdateMock = Message.update as jest.Mock;
  const showTicketServiceMock = ShowTicketService as jest.Mock;
  const startWhatsAppSessionVerifyMock =
    StartWhatsAppSessionVerify as jest.Mock;
  const getTicketWbotMock = GetTicketWbot as jest.Mock;
  const socketEmitMock = socketEmit as jest.Mock;
  const consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("updates messages and asks for WhatsApp session verification when sendSeen fails", async () => {
    const sendSeenError = new Error("session closed");
    const ticketReload = { id: 123, unreadMessages: 0 };
    const ticket = {
      id: 123,
      tenantId: 8,
      whatsappId: 55,
      channel: "whatsapp",
      isGroup: false,
      contact: {
        number: "5511999999999"
      },
      update: jest.fn().mockResolvedValue(undefined)
    };
    const sendSeen = jest.fn().mockRejectedValue(sendSeenError);
    getTicketWbotMock.mockResolvedValue({ sendSeen });
    showTicketServiceMock.mockResolvedValue(ticketReload);

    await SetTicketMessagesAsRead(ticket as any);
    await Promise.resolve();

    expect(messageUpdateMock).toHaveBeenCalledWith(
      { read: true },
      {
        where: {
          ticketId: 123,
          read: false
        }
      }
    );
    expect(ticket.update).toHaveBeenCalledWith({ unreadMessages: 0 });
    expect(sendSeen).toHaveBeenCalledWith("5511999999999@c.us");
    expect(startWhatsAppSessionVerifyMock).toHaveBeenCalledWith(
      55,
      sendSeenError
    );
    expect(showTicketServiceMock).toHaveBeenCalledWith({
      id: 123,
      tenantId: 8
    });
    expect(socketEmitMock).toHaveBeenCalledWith({
      tenantId: 8,
      type: "ticket:update",
      payload: ticketReload
    });
  });
});
