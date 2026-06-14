import Image from "next/image"

export default function Logo() {
  return (
    <Image
      src="/images/Logo-1.png"
      alt="PubInsights"
      width={150}
      height={40}
      className="w-auto h-8"
    />
  )
}

