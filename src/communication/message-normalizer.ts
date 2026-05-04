/**
 * 消息标准化层
 * 
 * 将不同渠道的消息格式统一为标准化的 NormalizedMessage 格式
 */

import type { ChannelType } from '../channels/chat-type.js';

// ==================== 类型定义 ====================

/**
 * 消息发送者
 */
export interface MessageSender {
  id: string;              // 发送者ID
  name?: string;           // 显示名称
  avatar?: string;         // 头像URL
  isBot?: boolean;         // 是否为机器人
  metadata?: Record<string, unknown>; // 渠道特定元数据
}

/**
 * 消息内容类型
 */
export type MessageContentType = 'text' | 'markdown' | 'html' | 'image' | 'video' | 'audio' | 'file';

/**
 * 消息内容
 */
export interface MessageContent {
  type: MessageContentType;
  text?: string;           // 文本内容
  html?: string;           // HTML内容（如果适用）
  mediaUrl?: string;       // 媒体URL（图片/视频/音频）
  fileName?: string;       // 文件名（如果是文件）
  mimeType?: string;       // MIME类型
}

/**
 * 消息附件
 */
export interface MessageAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;           // 文件大小（字节）
  width?: number;          // 图片宽度
  height?: number;         // 图片高度
  duration?: number;       // 音视频时长（秒）
  thumbnail?: string;      // 缩略图URL
}

/**
 * 标准化消息
 */
export interface NormalizedMessage {
  id: string;                    // 消息唯一ID
  channelId: string;             // 渠道ID
  channelType: ChannelType;      // 渠道类型
  conversationId: string;        // 会话/对话ID
  sender: MessageSender;         // 发送者
  content: MessageContent;       // 消息内容
  attachments: MessageAttachment[]; // 附件列表
  timestamp: number;             // 时间戳（毫秒）
  editedAt?: number;             // 编辑时间（如果已编辑）
  replyTo?: string;              // 回复的消息ID
  mentions?: string[];           // 提及的用户ID列表
  reactions?: Map<string, number>; // 表情反应 {emoji: count}
  metadata: Record<string, unknown>; // 渠道特定元数据
}

/**
 * 原始渠道消息（通用接口）
 */
export interface RawChannelMessage {
  id: string;
  [key: string]: any;
}

// ==================== 消息标准化器 ====================

/**
 * 消息标准化器类
 */
export class MessageNormalizer {
  /**
   * 将原始渠道消息转换为标准化格式
   */
  normalize(raw: RawChannelMessage, channelType: ChannelType): NormalizedMessage {
    switch (channelType) {
      case 'matrix':
        return this.normalizeMatrixMessage(raw);
      case 'slack':
        return this.normalizeSlackMessage(raw);
      case 'discord':
        return this.normalizeDiscordMessage(raw);
      case 'telegram':
        return this.normalizeTelegramMessage(raw);
      case 'whatsapp':
        return this.normalizeWhatsAppMessage(raw);
      case 'feishu':
        return this.normalizeFeishuMessage(raw);
      case 'line':
        return this.normalizeLineMessage(raw);
      default:
        return this.normalizeGenericMessage(raw, channelType);
    }
  }
  
  /**
   * Matrix 消息标准化
   */
  private normalizeMatrixMessage(raw: any): NormalizedMessage {
    const content = raw.content || {};
    const eventType = content.msgtype || 'm.text';
    
    let messageContent: MessageContent;
    
    if (eventType === 'm.text') {
      messageContent = {
        type: 'text',
        text: content.body || '',
      };
    } else if (eventType === 'm.image') {
      messageContent = {
        type: 'image',
        text: content.body || '',
        mediaUrl: content.url,
        mimeType: content.info?.mimetype,
      };
    } else {
      messageContent = {
        type: 'text',
        text: JSON.stringify(content),
      };
    }
    
    return {
      id: raw.event_id || `matrix_${Date.now()}`,
      channelId: raw.room_id || '',
      channelType: 'matrix',
      conversationId: raw.room_id || '',
      sender: {
        id: raw.sender || raw.user_id || '',
        name: raw.sender || raw.user_id,
        metadata: {
          displayname: content.displayname,
        },
      },
      content: messageContent,
      attachments: this.extractAttachments(raw, 'matrix'),
      timestamp: raw.origin_server_ts || Date.now(),
      replyTo: content['m.relates_to']?.['m.in_reply_to']?.event_id,
      metadata: {
        room_id: raw.room_id,
        event_type: raw.type,
        ...raw,
      },
    };
  }
  
  /**
   * Slack 消息标准化
   */
  private normalizeSlackMessage(raw: any): NormalizedMessage {
    return {
      id: raw.ts || `slack_${Date.now()}`,
      channelId: raw.channel || '',
      channelType: 'slack',
      conversationId: raw.channel || '',
      sender: {
        id: raw.user || '',
        name: raw.username || raw.user,
        isBot: raw.bot_id !== undefined,
        metadata: {
          bot_id: raw.bot_id,
          team_id: raw.team,
        },
      },
      content: {
        type: raw.blocks ? 'markdown' : 'text',
        text: raw.text || '',
      },
      attachments: this.extractAttachments(raw, 'slack'),
      timestamp: parseFloat(raw.ts) * 1000 || Date.now(),
      editedAt: raw.edited ? parseFloat(raw.edited.ts) * 1000 : undefined,
      replyTo: raw.thread_ts !== raw.ts ? raw.thread_ts : undefined,
      reactions: this.extractReactions(raw),
      metadata: {
        channel: raw.channel,
        team: raw.team,
        ...raw,
      },
    };
  }
  
  /**
   * Discord 消息标准化
   */
  private normalizeDiscordMessage(raw: any): NormalizedMessage {
    return {
      id: raw.id || `discord_${Date.now()}`,
      channelId: raw.channel_id || '',
      channelType: 'discord',
      conversationId: raw.channel_id || '',
      sender: {
        id: raw.author?.id || '',
        name: raw.author?.username || '',
        avatar: raw.author?.avatar ? 
          `https://cdn.discordapp.com/avatars/${raw.author.id}/${raw.author.avatar}.png` : 
          undefined,
        isBot: raw.author?.bot || false,
        metadata: {
          discriminator: raw.author?.discriminator,
        },
      },
      content: {
        type: 'text',
        text: raw.content || '',
      },
      attachments: this.extractDiscordAttachments(raw.attachments || []),
      timestamp: new Date(raw.timestamp || Date.now()).getTime(),
      editedAt: raw.edited_timestamp ? new Date(raw.edited_timestamp).getTime() : undefined,
      replyTo: raw.message_reference?.message_id,
      mentions: raw.mentions?.map((m: any) => m.id) || [],
      reactions: this.extractDiscordReactions(raw.reactions),
      metadata: {
        guild_id: raw.guild_id,
        channel_id: raw.channel_id,
        ...raw,
      },
    };
  }
  
  /**
   * Telegram 消息标准化
   */
  private normalizeTelegramMessage(raw: any): NormalizedMessage {
    const message = raw.message || raw;
    
    let messageContent: MessageContent;
    
    if (message.text) {
      messageContent = {
        type: 'text',
        text: message.text,
      };
    } else if (message.photo) {
      const photo = Array.isArray(message.photo) ? message.photo[message.photo.length - 1] : message.photo;
      messageContent = {
        type: 'image',
        text: message.caption || '',
        mediaUrl: `https://api.telegram.org/file/botTOKEN/${photo.file_id}`,
      };
    } else if (message.document) {
      messageContent = {
        type: 'file',
        text: message.caption || '',
        fileName: message.document.file_name,
        mimeType: message.document.mime_type,
      };
    } else {
      messageContent = {
        type: 'text',
        text: JSON.stringify(message),
      };
    }
    
    return {
      id: String(message.message_id) || `telegram_${Date.now()}`,
      channelId: String(message.chat?.id) || '',
      channelType: 'telegram',
      conversationId: String(message.chat?.id) || '',
      sender: {
        id: String(message.from?.id) || '',
        name: message.from?.username || message.from?.first_name || '',
        metadata: {
          first_name: message.from?.first_name,
          last_name: message.from?.last_name,
          username: message.from?.username,
        },
      },
      content: messageContent,
      attachments: this.extractAttachments(raw, 'telegram'),
      timestamp: (message.date || Date.now()) * 1000,
      replyTo: message.reply_to_message?.message_id ? String(message.reply_to_message.message_id) : undefined,
      metadata: {
        chat_id: message.chat?.id,
        message_id: message.message_id,
        ...raw,
      },
    };
  }
  
  /**
   * WhatsApp 消息标准化
   */
  private normalizeWhatsAppMessage(raw: any): NormalizedMessage {
    return {
      id: raw.id || `whatsapp_${Date.now()}`,
      channelId: raw.from || '',
      channelType: 'whatsapp',
      conversationId: raw.from || '',
      sender: {
        id: raw.from || '',
        name: raw.profile?.name || raw.from,
        metadata: {
          phone: raw.from,
        },
      },
      content: {
        type: 'text',
        text: raw.body || '',
      },
      attachments: this.extractAttachments(raw, 'whatsapp'),
      timestamp: raw.timestamp ? parseInt(raw.timestamp) * 1000 : Date.now(),
      metadata: {
        from: raw.from,
        to: raw.to,
        ...raw,
      },
    };
  }
  
  /**
   * 飞书消息标准化
   */
  private normalizeFeishuMessage(raw: any): NormalizedMessage {
    return {
      id: raw.message_id || `feishu_${Date.now()}`,
      channelId: raw.chat_id || '',
      channelType: 'feishu',
      conversationId: raw.chat_id || '',
      sender: {
        id: raw.sender_id || '',
        name: raw.sender?.name || raw.sender_id,
        metadata: {
          open_id: raw.sender?.open_id,
          union_id: raw.sender?.union_id,
        },
      },
      content: {
        type: 'text',
        text: raw.content?.text || '',
      },
      attachments: this.extractAttachments(raw, 'feishu'),
      timestamp: raw.create_time ? parseInt(raw.create_time) * 1000 : Date.now(),
      metadata: {
        chat_id: raw.chat_id,
        message_id: raw.message_id,
        ...raw,
      },
    };
  }
  
  /**
   * LINE 消息标准化
   */
  private normalizeLineMessage(raw: any): NormalizedMessage {
    const message = raw.message || {};
    
    let messageContent: MessageContent;
    
    if (message.type === 'text') {
      messageContent = {
        type: 'text',
        text: message.text || '',
      };
    } else if (message.type === 'image') {
      messageContent = {
        type: 'image',
        mediaUrl: message.contentProvider?.originalContentUrl,
      };
    } else {
      messageContent = {
        type: 'text',
        text: JSON.stringify(message),
      };
    }
    
    return {
      id: raw.message?.id || `line_${Date.now()}`,
      channelId: raw.source?.groupId || raw.source?.userId || '',
      channelType: 'line',
      conversationId: raw.source?.groupId || raw.source?.userId || '',
      sender: {
        id: raw.source?.userId || '',
        name: raw.source?.userId,
        metadata: {
          groupId: raw.source?.groupId,
          roomId: raw.source?.roomId,
        },
      },
      content: messageContent,
      attachments: this.extractAttachments(raw, 'line'),
      timestamp: raw.timestamp || Date.now(),
      metadata: {
        source: raw.source,
        ...raw,
      },
    };
  }
  
  /**
   * 通用消息标准化（fallback）
   */
  private normalizeGenericMessage(raw: any, channelType: ChannelType): NormalizedMessage {
    return {
      id: raw.id || `${channelType}_${Date.now()}`,
      channelId: raw.channelId || raw.channel || '',
      channelType,
      conversationId: raw.conversationId || raw.channelId || raw.channel || '',
      sender: {
        id: raw.sender?.id || raw.userId || raw.from || '',
        name: raw.sender?.name || raw.username || raw.from,
        isBot: raw.sender?.isBot || raw.isBot || false,
      },
      content: {
        type: 'text',
        text: raw.content?.text || raw.text || raw.body || JSON.stringify(raw),
      },
      attachments: [],
      timestamp: raw.timestamp || raw.createdAt || Date.now(),
      metadata: {
        ...raw,
      },
    };
  }
  
  // ==================== 辅助方法 ====================
  
  /**
   * 提取附件（通用）
   */
  private extractAttachments(raw: any, channelType: ChannelType): MessageAttachment[] {
    // 根据不同渠道实现附件提取逻辑
    // 这里提供基础实现，具体渠道可以覆盖
    return [];
  }
  
  /**
   * 提取 Discord 附件
   */
  private extractDiscordAttachments(attachments: any[]): MessageAttachment[] {
    return attachments.map((att: any) => ({
      id: att.id,
      type: this.getAttachmentType(att.filename, att.content_type),
      url: att.url,
      filename: att.filename,
      mimeType: att.content_type,
      size: att.size,
      width: att.width,
      height: att.height,
    }));
  }
  
  /**
   * 提取表情反应（Slack）
   */
  private extractReactions(raw: any): Map<string, number> | undefined {
    if (!raw.reactions || raw.reactions.length === 0) {
      return undefined;
    }
    
    const reactions = new Map<string, number>();
    for (const reaction of raw.reactions) {
      reactions.set(reaction.name, reaction.count);
    }
    
    return reactions;
  }
  
  /**
   * 提取 Discord 表情反应
   */
  private extractDiscordReactions(reactions: any[]): Map<string, number> | undefined {
    if (!reactions || reactions.length === 0) {
      return undefined;
    }
    
    const reactionMap = new Map<string, number>();
    for (const reaction of reactions) {
      const emoji = reaction.emoji?.name || reaction.emoji?.id || '?';
      reactionMap.set(emoji, reaction.count);
    }
    
    return reactionMap;
  }
  
  /**
   * 判断附件类型
   */
  private getAttachmentType(filename?: string, mimeType?: string): 'image' | 'video' | 'audio' | 'file' {
    if (mimeType) {
      if (mimeType.startsWith('image/')) return 'image';
      if (mimeType.startsWith('video/')) return 'video';
      if (mimeType.startsWith('audio/')) return 'audio';
    }
    
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return 'image';
      if (['mp4', 'avi', 'mov', 'webm'].includes(ext || '')) return 'video';
      if (['mp3', 'wav', 'ogg', 'flac'].includes(ext || '')) return 'audio';
    }
    
    return 'file';
  }
}

// ==================== 单例实例 ====================

/**
 * 全局消息标准化器实例
 */
let globalNormalizer: MessageNormalizer | null = null;

/**
 * 获取全局消息标准化器实例
 */
export function getMessageNormalizer(): MessageNormalizer {
  if (!globalNormalizer) {
    globalNormalizer = new MessageNormalizer();
  }
  
  return globalNormalizer;
}

/**
 * 重置全局消息标准化器（用于测试）
 */
export function resetMessageNormalizer(): void {
  globalNormalizer = null;
}
