import Closing from '../components/Closing';
import Advantages from '../sections/Advantages';
import Experience from '../sections/Experience';
import Hero from '../sections/Hero';
import Knowledge from '../sections/Knowledge';
import Work from '../sections/Work';

export default function Home() {
  return (
    <>
      <Hero />
      <Experience />
      <Work />
      {/* 知识谱系：放在"精选项目"与"个人优势"之间 —— 项目之后给一个"这些能力从哪来"的答案 */}
      <Knowledge />
      <Advantages />
      <Closing />
    </>
  );
}
