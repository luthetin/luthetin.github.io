import Closing from '../components/Closing';
import Advantages from '../sections/Advantages';
import Experience from '../sections/Experience';
import Hero from '../sections/Hero';
import Work from '../sections/Work';

export default function Home() {
  return (
    <>
      <Hero />
      <Experience />
      <Work />
      <Advantages />
      <Closing />
    </>
  );
}
