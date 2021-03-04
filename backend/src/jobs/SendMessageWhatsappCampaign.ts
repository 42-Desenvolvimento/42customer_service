/* eslint-disable @typescript-eslint/no-explicit-any */
import { join } from "path";
import { MessageMedia, Message as WbotMessage } from "whatsapp-web.js";
import { logger } from "../utils/logger";
import { getWbot } from "../libs/wbot";
import CampaignContacts from "../models/CampaignContacts";

export default {
  key: "SendMessageWhatsappCampaign",
  options: {
    delay: 5000
  },
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async handle({ data }: any) {
    try {
      /// feito por está apresentando problema com o tipo
      const wbot = getWbot(data.whatsappId);
      let message = {} as WbotMessage;
      if (data.mediaUrl) {
        const customPath = join(__dirname, "..", "..", "..", "public");
        const mediaPath = join(
          process.env.PATH_OFFLINE_MEDIA || customPath,
          data.mediaName
        );
        const newMedia = MessageMedia.fromFilePath(mediaPath);
        message = await wbot.sendMessage(`${data.number}@c.us`, newMedia, {
          sendAudioAsVoice: true,
          caption: data.message
        });
      } else {
        message = await wbot.sendMessage(`${data.number}@c.us`, data.message, {
          linkPreview: false
        });
      }
      await CampaignContacts.update(
        { messageId: message.id.id, messageRandom: data.messageRandom },
        { where: { id: data.campaignContact.id } }
      );
      return message;
    } catch (error) {
      logger.error(`Error enviar message campaign: ${error}`);
      throw new Error(error);
    }
  }
};
