import fs from "fs";
import os from "os";
import path from "path";
import GetTicketWbot from "../../../helpers/GetTicketWbot";
import { initWbot, removeWbot } from "../../../libs/wbot";
import Whatsapp from "../../../models/Whatsapp";
import FindOrCreateTicketService from "../../../services/TicketServices/FindOrCreateTicketService";
import SendWhatsAppMedia from "../../../services/WbotServices/SendWhatsAppMedia";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import SyncUnreadMessagesWbot from "../../../services/WbotServices/SyncUnreadMessagesWbot";
import VerifyStepsChatFlowTicket from "../../../services/ChatFlowServices/VerifyStepsChatFlowTicket";
import VerifyContact from "../../../services/WbotServices/helpers/VerifyContact";
import VerifyMessage from "../../../services/WbotServices/helpers/VerifyMessage";

jest.mock("whatsapp-web.js", () => ({
  MessageMedia: {
    fromFilePath: jest.fn(() => ({ data: "", mimetype: "text/plain" }))
  }
}));

jest.mock("../../../helpers/GetTicketWbot", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../models/UserMessagesLog", () => ({
  __esModule: true,
  default: {
    create: jest.fn()
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: jest.fn() }))
}));

jest.mock("../../../libs/Queue", () => ({
  __esModule: true,
  default: {
    add: jest.fn()
  }
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/InstagramBotServices/StartInstaBotSession", () => ({
  StartInstaBotSession: jest.fn()
}));

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock("../../../services/MessengerChannelServices/StartMessengerBot", () => ({
  StartMessengerBot: jest.fn()
}));

jest.mock("../../../services/TicketServices/FindOrCreateTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/ChatFlowServices/VerifyStepsChatFlowTicket", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/WbotServices/helpers/VerifyContact", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/WbotServices/helpers/VerifyMediaMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../services/WbotServices/helpers/VerifyMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));

const mockedInitWbot = initWbot as jest.Mock;
const mockedRemoveWbot = removeWbot as jest.Mock;
const mockedFindWhatsapp = Whatsapp.findByPk as jest.Mock;
const mockedGetTicketWbot = GetTicketWbot as jest.Mock;
const mockedFindOrCreateTicket = FindOrCreateTicketService as jest.Mock;
const mockedVerifyContact = VerifyContact as jest.Mock;
const mockedVerifyMessage = VerifyMessage as jest.Mock;
const mockedVerifySteps = VerifyStepsChatFlowTicket as jest.Mock;

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFindWhatsapp.mockResolvedValue(null);
    mockedInitWbot.mockResolvedValue({ id: 42 });
  });

  it("removes the stale cached session before recovering from sendSeen errors", async () => {
    const calls: string[] = [];
    const whatsapp = {
      id: 42,
      tenantId: 1,
      update: jest.fn()
    };

    mockedFindWhatsapp.mockResolvedValue(whatsapp);
    mockedRemoveWbot.mockImplementation(() => calls.push("remove"));
    mockedInitWbot.mockImplementation(async () => {
      calls.push("init");
      return { id: 42 };
    });

    await StartWhatsAppSessionVerify(
      42,
      new Error("TypeError: Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockedRemoveWbot).toHaveBeenCalledWith(42);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
  });

  it("removes the cached session before starting a WhatsApp channel", async () => {
    const calls: string[] = [];
    const whatsapp = {
      id: 42,
      tenantId: 1,
      type: "whatsapp",
      update: jest.fn()
    };

    mockedRemoveWbot.mockImplementation(() => calls.push("remove"));
    mockedInitWbot.mockImplementation(async () => {
      calls.push("init");
      return { id: 42 };
    });

    await StartWhatsAppSession(whatsapp as any);

    expect(mockedRemoveWbot).toHaveBeenCalledWith(42);
    expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(calls).toEqual(["remove", "init"]);
  });

  it("removes uploaded media files when WhatsApp send fails", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wbot-media-"));
    const mediaPath = path.join(tempDir, "media.txt");
    fs.writeFileSync(mediaPath, "temporary media");

    mockedGetTicketWbot.mockResolvedValue({
      sendMessage: jest.fn().mockRejectedValue(new Error("session closed"))
    });

    await expect(
      SendWhatsAppMedia({
        media: {
          path: mediaPath,
          filename: "media.txt"
        } as Express.Multer.File,
        ticket: {
          id: 10,
          whatsappId: 42,
          contact: { number: "5511999999999" },
          isGroup: false,
          update: jest.fn()
        } as any,
        userId: undefined
      })
    ).rejects.toMatchObject({ message: "ERR_SENDING_WAPP_MSG" });

    expect(fs.existsSync(mediaPath)).toBe(false);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("waits for unread messages to be persisted before resolving", async () => {
    let releaseVerifyMessage!: () => void;
    let resolved = false;
    const contact = { id: 9 };
    const ticket = {
      id: 10,
      apiConfig: {},
      isCampaignMessage: false,
      isFarewellMessage: false,
      isGroup: false,
      answered: false
    };
    const msg = {
      hasMedia: false,
      fromMe: false,
      id: { id: "message-id" }
    };
    const chat = {
      unreadCount: 1,
      isGroup: false,
      fetchMessages: jest.fn().mockResolvedValue([msg]),
      getContact: jest.fn().mockResolvedValue({ id: "contact-id" })
    };

    mockedVerifyContact.mockResolvedValue(contact);
    mockedFindOrCreateTicket.mockResolvedValue(ticket);
    mockedVerifyMessage.mockReturnValue(
      new Promise<void>(resolve => {
        releaseVerifyMessage = resolve;
      })
    );
    mockedVerifySteps.mockResolvedValue(undefined);

    const syncPromise = SyncUnreadMessagesWbot(
      {
        id: 42,
        getChats: jest.fn().mockResolvedValue([chat])
      } as any,
      1
    ).then(() => {
      resolved = true;
    });

    await new Promise(resolve => setImmediate(resolve));

    expect(mockedVerifyMessage).toHaveBeenCalledWith(msg, ticket, contact);
    expect(resolved).toBe(false);

    releaseVerifyMessage();
    await syncPromise;

    expect(mockedVerifySteps).toHaveBeenCalledWith(msg, ticket);
  });
});
