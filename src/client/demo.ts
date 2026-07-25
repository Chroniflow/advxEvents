import type { PublicStoryWithLikes } from "../shared/contracts";

const base = { revisionId: "demo", images: [], publishedAt: "2026-07-25T00:00:00.000Z" };
export const demoStories: PublicStoryWithLikes[] = [
  { ...base, storyId: "demo-1", title: "我不是来赢的，我只是第一次遇见这么多认真做梦的人。", body: "场馆凌晨依然亮着。有人写代码，有人焊板子，也有人只是坐在地上认真听另一个人讲他的梦。", author: { anonymous: true }, likeCount: 214 },
  { ...base, storyId: "demo-2", title: "凌晨四点，我们终于让那块板子亮了起来", body: "没有人欢呼。大家只是盯着那颗绿色 LED，像看见一颗很远的星。", author: { anonymous: false, login: "linbuilds", name: "Lin", avatarUrl: "", profileUrl: "https://github.com/linbuilds" }, likeCount: 126 },
  { ...base, storyId: "demo-3", title: "如果在问题中前进，胜于追求完美。", body: "最后一次构建开始的时候，距离路演只剩十分钟。", author: { anonymous: true }, likeCount: 87 },
  { ...base, storyId: "demo-4", title: "那一晚的部署记录，以及后来没人再提起的错误", body: "服务器在路演前十分钟恢复。我们把最后一次构建推上去，在走廊尽头听见主持人叫到项目名字。后来合照里每个人都在笑，只有我们知道那十分钟发生过什么。", author: { anonymous: false, login: "icebraker", name: "icebraker", avatarUrl: "", profileUrl: "https://github.com/icebraker" }, likeCount: 103 },
  { ...base, storyId: "demo-5", title: "一张没有拍下来的合照", body: "相机没电了，但那一刻每个人都记得。", author: { anonymous: false, login: "mori", name: "Mori", avatarUrl: "", profileUrl: "https://github.com/mori" }, likeCount: 42 },
];

