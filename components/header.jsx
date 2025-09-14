"use client";

import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { PenBox, LayoutDashboard, Menu, X, LogOut, User } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useFirebaseAuth } from "@/components/FirebaseAuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { user, signOutUser } = useFirebaseAuth();

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { name: "Features", href: "#features" },
    { name: "Testimonials", href: "#testimonials" },
    { name: "Pricing", href: "#pricing" },
  ];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-lg shadow-sm py-2 border-b border-gray-100"
          : "bg-white/80 backdrop-blur-md py-4"
      }`}
    >
      <nav className="container mx-auto px-4 flex items-center justify-between">
        {/* Logo with animation */}
        <motion.div
          initial={mounted ? { opacity: 0, x: -20 } : false}
          animate={mounted ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <Link href="/" className="flex items-center">
            <Image
              src="/Logo.png"
              alt="FinBox Logo"
              width={200}
              height={60}
              className={`transition-all ${
                scrolled ? "h-10 w-auto" : "h-12 w-auto"
              } object-contain`}
            />
           
          </Link>
        </motion.div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-6">
          {!user && navItems.map((item) => (
            <motion.a
              key={item.name}
              href={item.href}
              whileHover={mounted ? { scale: 1.05, color: "#2563eb" } : {}}
              className={`text-gray-600 hover:text-blue-600 px-3 py-2 rounded-lg transition-colors ${
                pathname === item.href ? "text-blue-600 font-medium" : ""
              }`}
            >
              {item.name}
            </motion.a>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-4">
          {user && (
            <>
              <motion.div whileHover={mounted ? { scale: 1.05 } : {}} className="mr-2">
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 border-gray-300 hover:border-blue-400"
                  >
                    <LayoutDashboard size={18} />
                    <span className="hidden md:inline">Dashboard</span>
                  </Button>
                </Link>
              </motion.div>

              <motion.div whileHover={mounted ? { scale: 1.05 } : {}}>
                <Link href="/transaction/create">
                  <Button className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md">
                    <PenBox size={18} />
                    <span className="hidden md:inline">Add Transaction</span>
                  </Button>
                </Link>
              </motion.div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    whileHover={mounted ? { scale: 1.05 } : {}}
                    className="ml-2"
                  >
                    <Avatar className="w-10 h-10 border-2 border-blue-100 hover:border-blue-200 transition-all cursor-pointer">
                      <AvatarImage src={user.photoURL} alt={user.displayName || user.email} />
                      <AvatarFallback>
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOutUser} className="flex items-center text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {!user && (
            <motion.div whileHover={mounted ? { scale: 1.05 } : {}}>
              <Link href="/sign-in">
                <Button
                  variant="outline"
                  className="border-gray-300 hover:border-blue-400"
                >
                  Login
                </Button>
              </Link>
            </motion.div>
          )}

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 ml-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden overflow-hidden"
          >
            <div className="container mx-auto px-4 py-3 space-y-3">
              {!user && navItems.map((item) => (
                <motion.a
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {item.name}
                </motion.a>
              ))}
              <div className="pt-2 border-t border-gray-100 space-y-3">
                {user && (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/transaction/create"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Add Transaction
                    </Link>
                    <Link
                      href="/account"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Account
                    </Link>
                    <button
                      onClick={() => {
                        signOutUser();
                        setMobileMenuOpen(false);
                      }}
                      className="block w-full text-left text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Sign out
                    </button>
                  </>
                )}
                {!user && (
                  <Link
                    href="/sign-in"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-gray-700 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;